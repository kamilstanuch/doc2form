/**
 * Predefined prompt templates.
 * Each has a name, icon (Material Icons), short description, and the actual prompt text.
 * Add your own or modify these to fit your needs.
 */
var PROMPT_TEMPLATES = [
  {
    id: 'feedback',
    name: 'Customer Feedback',
    icon: 'rate_review',
    description: 'Collect product or service feedback',
    prompt: 'Create a customer feedback form with questions about overall satisfaction (1-5 scale), what they liked most (multiple choice), areas for improvement (checkboxes), and an open-ended suggestions field. Keep it short and focused — no more than 8 questions.'
  },
  {
    id: 'event',
    name: 'Event Registration',
    icon: 'event',
    description: 'Sign-up form for events or workshops',
    prompt: 'Create an event registration form. Include fields for full name, email, phone number, organization/company, dietary restrictions (checkboxes: Vegetarian, Vegan, Gluten-free, No restrictions, Other), t-shirt size (dropdown: XS, S, M, L, XL, XXL), how they heard about the event (multiple choice), and any special accommodations needed (paragraph).'
  },
  {
    id: 'survey',
    name: 'Employee Survey',
    icon: 'groups',
    description: 'Anonymous workplace satisfaction survey',
    prompt: 'Create an anonymous employee satisfaction survey with sections for: Work Environment (scale questions about workspace, tools, collaboration), Management (scale questions about communication, support, fairness), Growth (questions about training opportunities, career development), and Overall (recommendation likelihood 1-10, open comments). Use section headers to organize it.'
  },
  {
    id: 'quiz',
    name: 'Quiz / Assessment',
    icon: 'quiz',
    description: 'Generate a quiz or knowledge test',
    prompt: 'Create a 10-question multiple choice quiz. Ask me what topic the quiz should cover, or generate a general knowledge quiz. Each question should have 4 options. Mix difficulty levels — some easy, some medium, some hard.'
  },
  {
    id: 'contact',
    name: 'Contact Form',
    icon: 'contact_mail',
    description: 'Simple contact or inquiry form',
    prompt: 'Create a clean contact form with: full name (required), email address (required), phone number (optional), subject/reason for contact (dropdown: General Inquiry, Support, Partnership, Feedback, Other), message (paragraph, required), and preferred contact method (multiple choice: Email, Phone, Either).'
  },
  {
    id: 'application',
    name: 'Job Application',
    icon: 'work',
    description: 'Collect job applications',
    prompt: 'Create a job application form with sections: Personal Information (name, email, phone, location), Professional Background (current role, years of experience, relevant skills as checkboxes), Availability (start date, work preference: Full-time/Part-time/Contract as dropdown), and a final paragraph field for "Why are you interested in this position?". Use section headers.'
  },
  {
    id: 'rsvp',
    name: 'RSVP / Invitation',
    icon: 'celebration',
    description: 'Party, wedding, or gathering RSVP',
    prompt: 'Create an RSVP form for a social event. Include: full name, attending? (Yes/No/Maybe as multiple choice), number of guests (dropdown: 0-5), meal preference (multiple choice: Meat, Fish, Vegetarian, Vegan), allergies or dietary notes (short answer, optional), song request (short answer, optional), and any message for the host (paragraph, optional). Keep it fun and friendly.'
  },
  {
    id: 'order',
    name: 'Order Form',
    icon: 'shopping_cart',
    description: 'Product or service order form',
    prompt: 'Create a product order form with: customer name, email, phone, shipping address (paragraph), product selection (checkboxes with sample product names), quantity per item (short answer), preferred delivery date (date field), special instructions (paragraph, optional), and payment method preference (dropdown: Credit Card, PayPal, Bank Transfer, Cash on Delivery).'
  }
];
