/**
 * Serves the HTML Web App.
 */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Doc2Form — AI Form Generator')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Returns prompt templates to the frontend.
 */
function getPromptTemplates() {
  return PROMPT_TEMPLATES;
}

/**
 * Main entry point — generates a Google Form from text and/or file data.
 * Returns edit URL and published URL on success.
 */
function generateFormSmart(rawText, fileData) {
  try {
    var formData = callGemini(rawText, fileData);
    validateFormData(formData);
    var urls = createGoogleForm(formData);
    return { success: true, editUrl: urls.editUrl, publishedUrl: urls.publishedUrl, title: formData.title };
  } catch (e) {
    Logger.log('generateFormSmart error: ' + e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Validates the parsed Gemini response before building a form.
 */
function validateFormData(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('Gemini returned invalid data. Please try again.');
  }
  if (!data.title || typeof data.title !== 'string') {
    throw new Error('Form title is missing from AI response.');
  }
  if (!Array.isArray(data.questions) || data.questions.length === 0) {
    throw new Error('No questions found in AI response. Try being more specific.');
  }
  var validTypes = [
    'SHORT_ANSWER', 'PARAGRAPH', 'MULTIPLE_CHOICE', 'CHECKBOX',
    'DROPDOWN', 'LINEAR_SCALE', 'DATE', 'TIME',
    'MULTIPLE_CHOICE_GRID', 'CHECKBOX_GRID', 'SECTION_HEADER'
  ];
  data.questions.forEach(function(q, i) {
    if (!q.title) throw new Error('Question ' + (i + 1) + ' is missing a title.');
    if (q.type && validTypes.indexOf(q.type) === -1) {
      q.type = 'SHORT_ANSWER';
    }
  });
}

/**
 * Google Forms ScaleItem: lower must be 0 or 1; upper must be 3–10 (inclusive). See setBounds docs.
 */
function clampScaleBounds(low, high) {
  var lo = Math.round(Number(low));
  var hi = Math.round(Number(high));
  if (!isFinite(lo) || (lo !== 0 && lo !== 1)) {
    lo = 1;
  }
  if (!isFinite(hi)) {
    hi = 5;
  }
  if (hi < 3) {
    hi = 3;
  }
  if (hi > 10) {
    hi = 10;
  }
  if (hi <= lo) {
    hi = Math.min(10, Math.max(3, lo + 2));
  }
  return [lo, hi];
}

/** Non-empty trimmed strings from an array (Gemini may omit, duplicate, or use numbers). */
function sanitizeStringArray(arr) {
  if (!arr || !Array.isArray(arr)) {
    return [];
  }
  return arr.map(function(s) {
    return String(s == null ? '' : s).trim();
  }).filter(function(s) {
    return s.length > 0;
  });
}

/** Multiple choice / checkbox / dropdown need at least 2 choices in practice; never pass empty to setChoiceValues. */
function ensureChoiceOptions(options, fallbackPrefix) {
  var opts = sanitizeStringArray(options);
  var prefix = fallbackPrefix || 'Option';
  while (opts.length < 2) {
    opts.push(prefix + ' ' + (opts.length + 1));
  }
  return opts;
}

/** Grid setRows / setColumns throw on empty arrays; both axes are required. */
function ensureGridAxes(rows, columns) {
  var r = sanitizeStringArray(rows);
  var c = sanitizeStringArray(columns);
  if (r.length === 0) {
    r = ['Row 1', 'Row 2'];
  }
  if (c.length === 0) {
    c = ['A', 'B', 'C'];
  }
  return { rows: r, columns: c };
}

/**
 * Calls Gemini API. Handles text-only, PDF (multimodal), and Word (pre-extracted text).
 */
function callGemini(text, fileData) {
  var apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not set. Go to Project Settings → Script Properties and add it.');
  }

  var model = 'gemini-2.5-flash';
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + apiKey;

  var contentParts = [];

  if (fileData) {
    contentParts.push({
      inline_data: {
        mime_type: fileData.mimeType,
        data: fileData.data
      }
    });
  }

  var finalText = text ? text.substring(0, 500000) : '';
  contentParts.push({
    text: 'Create a Google Form structure from the following content.\n' + finalText
  });

  var payload = {
    contents: [{ parts: contentParts }],
    system_instruction: {
      parts: [{
        text: GEMINI_SYSTEM_PROMPT
      }]
    },
    generationConfig: { response_mime_type: 'application/json' }
  };

  var options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch(url, options);
  var statusCode = response.getResponseCode();

  if (statusCode === 429) {
    throw new Error('API rate limit reached. Please wait a moment and try again.');
  }
  if (statusCode >= 500) {
    throw new Error('Gemini API is temporarily unavailable (HTTP ' + statusCode + '). Try again shortly.');
  }

  var jsonResponse = JSON.parse(response.getContentText());

  if (jsonResponse.error) {
    throw new Error('Gemini API error: ' + jsonResponse.error.message);
  }

  if (!jsonResponse.candidates || !jsonResponse.candidates[0] ||
      !jsonResponse.candidates[0].content || !jsonResponse.candidates[0].content.parts) {
    throw new Error('Unexpected response from Gemini. The model may have refused the request.');
  }

  var raw = jsonResponse.candidates[0].content.parts[0].text;
  try {
    return JSON.parse(raw);
  } catch (parseErr) {
    throw new Error('Could not parse AI response as JSON. Try again or shorten the document.');
  }
}

/**
 * System prompt for Gemini — defines the JSON schema for form generation.
 */
var GEMINI_SYSTEM_PROMPT = [
  'You are a Google Form generator. Your job is to create well-structured, thoughtful forms.',
  'Output strict JSON only. No markdown, no explanation.',
  '',
  'JSON Schema:',
  '{',
  '  "title": "Form Title",',
  '  "description": "Optional form description",',
  '  "questions": [',
  '    {',
  '      "title": "Question text",',
  '      "helpText": "Optional hint shown below the question",',
  '      "type": "SHORT_ANSWER | PARAGRAPH | MULTIPLE_CHOICE | CHECKBOX | DROPDOWN | LINEAR_SCALE | DATE | TIME | MULTIPLE_CHOICE_GRID | CHECKBOX_GRID | SECTION_HEADER",',
  '      "required": true,',
  '      "options": ["Option 1", "Option 2"],',
  '      "scaleMin": 1,',
  '      "scaleMax": 5,',
  '      "scaleMinLabel": "Not at all",',
  '      "scaleMaxLabel": "Very much",',
  '      "rows": ["Row 1", "Row 2"],',
  '      "columns": ["Col 1", "Col 2"]',
  '    }',
  '  ]',
  '}',
  '',
  'Rules:',
  '- "options" only for MULTIPLE_CHOICE, CHECKBOX, DROPDOWN',
  '- "scaleMin", "scaleMax", "scaleMinLabel", "scaleMaxLabel" only for LINEAR_SCALE',
  '- For LINEAR_SCALE: scaleMin must be 0 or 1 only; scaleMax must be an integer from 3 to 10 (Google Forms rule)',
  '- "rows" and "columns" only for MULTIPLE_CHOICE_GRID and CHECKBOX_GRID',
  '- Grids must each have at least two non-empty row labels and two non-empty column labels',
  '- SECTION_HEADER creates a visual page/section break with title and optional helpText as description',
  '- Default "required" to true for important fields, false for optional ones',
  '- Choose the most appropriate question type for each field',
  '- For documents: extract ALL fields faithfully, preserving the original structure',
  '- For text prompts: create a smart, well-organized form matching the user\'s intent',
  '- Always include at least a title and one question'
].join('\n');

/**
 * Builds a Google Form from structured data and returns both URLs.
 */
function createGoogleForm(data) {
  var form = FormApp.create(data.title || 'AI Generated Form');

  if (data.description) {
    form.setDescription(data.description);
  }

  form.setIsQuiz(false);
  form.setAllowResponseEdits(false);
  form.setCollectEmail(false);

  data.questions.forEach(function(q) {
    var item;

    switch (q.type) {
      case 'PARAGRAPH':
        item = form.addParagraphTextItem();
        break;

      case 'MULTIPLE_CHOICE':
        item = form.addMultipleChoiceItem();
        item.setChoiceValues(ensureChoiceOptions(q.options, 'Choice'));
        break;

      case 'CHECKBOX':
        item = form.addCheckboxItem();
        item.setChoiceValues(ensureChoiceOptions(q.options, 'Option'));
        break;

      case 'DROPDOWN':
        item = form.addListItem();
        item.setChoiceValues(ensureChoiceOptions(q.options, 'Option'));
        break;

      case 'LINEAR_SCALE':
        item = form.addScaleItem();
        var bounds = clampScaleBounds(q.scaleMin, q.scaleMax);
        item.setBounds(bounds[0], bounds[1]);
        // ScaleItem uses setLabels(lower, upper) — not setLeftLabel / setRightLabel
        if (q.scaleMinLabel || q.scaleMaxLabel) {
          item.setLabels(q.scaleMinLabel || '', q.scaleMaxLabel || '');
        }
        break;

      case 'DATE':
        item = form.addDateItem();
        break;

      case 'TIME':
        item = form.addTimeItem();
        break;

      case 'MULTIPLE_CHOICE_GRID':
        item = form.addGridItem();
        var gridAxes = ensureGridAxes(q.rows, q.columns);
        item.setRows(gridAxes.rows);
        item.setColumns(gridAxes.columns);
        break;

      case 'CHECKBOX_GRID':
        item = form.addCheckboxGridItem();
        var cbAxes = ensureGridAxes(q.rows, q.columns);
        item.setRows(cbAxes.rows);
        item.setColumns(cbAxes.columns);
        break;

      case 'SECTION_HEADER':
        item = form.addSectionHeaderItem();
        if (q.helpText) item.setHelpText(q.helpText);
        break;

      default:
        item = form.addTextItem();
        break;
    }

    item.setTitle(q.title);

    if (q.helpText && q.type !== 'SECTION_HEADER') {
      item.setHelpText(q.helpText);
    }

    if (q.required && typeof item.setRequired === 'function') {
      item.setRequired(q.required);
    }
  });

  return {
    editUrl: form.getEditUrl(),
    publishedUrl: form.getPublishedUrl()
  };
}
