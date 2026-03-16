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

  return JSON.parse(jsonResponse.candidates[0].content.parts[0].text);
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
  '- "rows" and "columns" only for MULTIPLE_CHOICE_GRID and CHECKBOX_GRID',
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
        if (q.options && q.options.length > 0) item.setChoiceValues(q.options);
        break;

      case 'CHECKBOX':
        item = form.addCheckboxItem();
        if (q.options && q.options.length > 0) item.setChoiceValues(q.options);
        break;

      case 'DROPDOWN':
        item = form.addListItem();
        if (q.options && q.options.length > 0) item.setChoiceValues(q.options);
        break;

      case 'LINEAR_SCALE': {
        item = form.addScaleItem();
        item.setBounds(q.scaleMin || 1, q.scaleMax || 5);
        item.setLabels(q.scaleMinLabel || '', q.scaleMaxLabel || '');
        break;
      }

      case 'DATE':
        item = form.addDateItem();
        break;

      case 'TIME':
        item = form.addTimeItem();
        break;

      case 'MULTIPLE_CHOICE_GRID':
        item = form.addGridItem();
        if (q.rows && q.rows.length > 0) item.setRows(q.rows);
        if (q.columns && q.columns.length > 0) item.setColumns(q.columns);
        break;

      case 'CHECKBOX_GRID':
        item = form.addCheckboxGridItem();
        if (q.rows && q.rows.length > 0) item.setRows(q.rows);
        if (q.columns && q.columns.length > 0) item.setColumns(q.columns);
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
