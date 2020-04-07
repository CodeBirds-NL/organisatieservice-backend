# Organisatieservice Node.js Backend

Handles form submissions, email notifications (Gmail API) and file upload to Google Drive.

## Installation
1. clone repo and run `npm install`
2. Make sure you include a `credentials.json` file in the project root to have the Google API working. (OAuth2)
   - for a quick demo go to https://developers.google.com/drive/api/v3/quickstart/nodejs?pli=1 and complete STEP 1. (that will generate a credentials file for you)
3. Add a `.env` file in the project root with the next environment variables:
   - `EMAIL_RECIPIENT=info@example.com`
   - `EMAIL_SENDER=me@example.com`
3. `npm start`, the app will run on port 3001. Have fun!
