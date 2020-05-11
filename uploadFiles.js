const fs = require("fs");
const readline = require("readline");
const { google } = require("googleapis");

// If modifying these scopes, delete token.json.
const SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/gmail.send",
];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = "token.json";

// store the authentication properties, used in all apis, here
function authorizeApiRequest(callback) {
  // Load client secrets from a local file.
  fs.readFile("credentials.json", (err, content) => {
    if (err) return console.log("Error loading client secret file:", err);
    // Authorize a client with credentials, then call the Google Drive API.
    authorize(JSON.parse(content));
  });

  /**
   * Create an OAuth2 client with the given credentials, and then execute the
   * given callback function.
   * @param {Object} credentials The authorization client credentials.
   * @param {function} callback The callback to call with the authorized client.
   */
  function authorize(credentials) {
    const { client_secret, client_id, redirect_uris } = credentials.web;
    const oAuth2Client = new google.auth.OAuth2(
      client_id,
      client_secret,
      redirect_uris[0]
    );

    // check first if the access token we have is valid
    oAuth2Client.on("tokens", (tokens) => {
      if (tokens.refresh_token) {
        // store the refresh_token in my database!
        fs.writeFile(TOKEN_PATH, JSON.stringify(tokens), (err) => {
          if (err) return console.error(err);
        });
        console.log(tokens.refresh_token);
      }
    });

    // Check if we have previously stored a token.
    fs.readFile(TOKEN_PATH, (err, token) => {
      if (err) return getAccessToken(oAuth2Client, callback);
      oAuth2Client.setCredentials(JSON.parse(token));
      callback(oAuth2Client); // continue with api request
    });
  }

  /**
   * Get and store new token after prompting for user authorization, and then
   * execute the given callback with the authorized OAuth2 client.
   * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
   * @param {getEventsCallback} callback The callback for the authorized client.
   */
  function getAccessToken(oAuth2Client) {
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: "offline",
      scope: SCOPES,
    });
    console.log("Authorize this app by visiting this url:", authUrl);
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question("Enter the code from that page here: ", (code) => {
      rl.close();
      oAuth2Client.getToken(code, (err, token) => {
        if (err) return console.error("Error retrieving access token", err);
        oAuth2Client.setCredentials(token);
        // Store the token to disk for later program executions
        fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
          if (err) return console.error(err);
          console.log("Token stored to", TOKEN_PATH);
        });
        callback(oAuth2Client); // continue with api request
      });
    });
  }
}

function uploadFiles(file, name, callback) {
  authorizeApiRequest((auth) => {
    //after request is authorized configure drive api
    const drive = google.drive({ version: "v3", auth });

    var fileMetadata = {
      name: file,
    };
    var media = {
      mimeType: "application/zip",
      // get zip file contents from tmp folder
      body: fs.createReadStream(`tmp/${file}`),
    };

    // shoot that file to drive!
    drive.files.create(
      {
        resource: fileMetadata,
        media: media,
        fields: "id",
      },
      function (err, file) {
        if (err) {
          // Handle error
          console.error(err);
        } else {
          // send email notification after successful upload
          sendMessage(auth, { fileId: file.data.id, name }, callback, "upload");
        }
      }
    );
  });
}

function handleFormEntry(data, callback) {
  authorizeApiRequest((auth) =>
    sendMessage(auth, data, callback, "form-entry")
  );
}

function makeBody(to, from, subject, message) {
  const str = [
    'Content-Type: text/html; charset="UTF-8"\n',
    "MIME-Version: 1.0\n",
    "Content-Transfer-Encoding: 7bit\n",
    "to: ",
    to,
    "\n",
    "from: ",
    from,
    "\n",
    "subject: ",
    subject,
    "\n\n",
    message,
  ].join("");

  const encodedMail = new Buffer.from(str)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return encodedMail;
}

/**
 * Send Message.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 * @param {file.data} fileId The id of the uploaded zip folder used to create a downloadlink
 * @param {name} name The name of the client who uploaded the files
 */

function sendMessage(auth, data, callback, src) {
  const gmail = google.gmail({ version: "v1", auth });
  let raw = {}; // contains email info like subject, body, sender, recipient

  // configure the raw object
  if (src === "upload") {
    const downloadLink = `https://drive.google.com/uc?export=download&id=${data.fileId}`;
    raw = makeBody(
      process.env.EMAIL_RECIPIENT,
      process.env.EMAIL_SENDER,
      `${data.name} heeft nieuwe bestanden geupload`,
      uploadNotificationEmailBody(data.name, downloadLink)
    );
  } else {
    raw = makeBody(
      process.env.EMAIL_RECIPIENT,
      process.env.EMAIL_SENDER,
      `Nieuwe aanvraag van ${data.name} via organisatieservice.nl`,
      formEntryNotificationEmailBody(data)
    );
  }

  // send out the message!
  gmail.users.messages.send(
    {
      userId: process.env.EMAIL_SENDER,
      resource: {
        raw,
      },
    },
    (err) => {
      if (err) return console.log(err);
      return callback();
    }
  );
}

function uploadNotificationEmailBody(name, downloadLink) {
  return `
  <html style="font-family: &quot;Lato&quot;;">
    <head>
      <link href="https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap" rel="stylesheet">
    </head>
    <body style="padding: 20px 30px;">
      <p style="font-size: 24px;font-weight: 700;color: #001010;line-height: 1.5em;margin: 1em 0;">Hallo Mathijs,</p>
      <p style="width: 500px;font-size: 20px;color: #001010;line-height: 1.5em;margin: 1em 0;">
        ${name} heeft nieuwe bestanden geüpload op je website.<br>
        Hieronder vindt je de link om de zip folder met de bestanden te downloaden.
        <br><p style="margin: 32px 0; font-size:18px;"><strong style="text-decoration: underline;">Let op:</strong> de link
          werkt alleen als je ingelogd bent in Google Drive of toegang hebt tot de
          gedeelde map.
      </p></p><br>
  
      <a class="btn" href=${downloadLink} style="font-size: 20px;color: #fff;line-height: 1em;display: block;width: fit-content;padding: 0.75em 1em;cursor: pointer;outline: 0;border: 3px solid #007be0;border-radius: 32px;-webkit-border-radius: 32px;background-color: #007be0;text-decoration: none;text-transform: capitalize;box-shadow: 5px 5px 22px 0 rgba(0, 0, 0, 0.06);transition: background-color 0.25s ease-out, color 0.25s ease-out,
            border-color 0.25s ease-out;">Download bestanden
      </a><br><br>
      <div style='font-size:20px;'>
        <p>Prettige werkdag!</p>
        <em style='font-size:18px; margin-top:5px;'>De websitebot</em>
      </div>
    </body>
  </html>
  `;
}

function formEntryNotificationEmailBody(data) {
  // now create the email body!
  return `
  <html style="font-family: &quot;Lato&quot;;">
  <head>
    <link href="https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap" rel="stylesheet">
  </head>
  <body style="padding: 20px 30px;">
    <p style="font-size: 24px;font-weight: 700;color: #001010;line-height: 1.5em;margin: 1em 0;">Hallo Mathijs,</p>
    <p style="width: 500px;font-size: 20px;color: #001010;line-height: 1.5em;margin: 1em 0;">
      ${
        data.name
      } heeft een nieuwe aanvraag gedaan op je website via het <strong>Direct Actie</strong> formulier.<br> 
      Hieronder vindt je de gegevens:</p><br>

    <table style='font-size:20px;'>
    <tr>
          <th align='left'>Dienst: </th>
          <td style='margin-left:20px;'>${data.dienst}</td>
        </tr>
    ${Object.entries(data)
      .map(([label, value], index) => {
        if (index >= Object.entries(data).length - 1) return;
        return `<tr>
          <th align='left'>${
            label.charAt(0).toUpperCase() + label.slice(1)
          }: </th>
          <td style='margin-left:20px;'>${value}</td>
        </tr>`;
      })
      .join("")}
    </table>
    <br><br>
    <div style='font-size:20px;'>
      <p>Prettige werkdag!</p>
      <em style='font-size:18px; margin-top:5px;'>De websitebot</em>
    </div>
  </body>
</html>`;
}

module.exports = {
  uploadFiles,
  handleFormEntry,
};
