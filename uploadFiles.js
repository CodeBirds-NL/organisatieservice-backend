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

function uploadFiles(file, name, callback) {
  // Load client secrets from a local file.
  fs.readFile("credentials.json", (err, content) => {
    if (err) return console.log("Error loading client secret file:", err);
    // Authorize a client with credentials, then call the Google Drive API.
    authorize(JSON.parse(content), storeFiles);
  });

  /**
   * Create an OAuth2 client with the given credentials, and then execute the
   * given callback function.
   * @param {Object} credentials The authorization client credentials.
   * @param {function} callback The callback to call with the authorized client.
   */
  function authorize(credentials, callback) {
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
      // console.log(tokens.access_token);
    });

    // Check if we have previously stored a token.
    fs.readFile(TOKEN_PATH, (err, token) => {
      if (err) return getAccessToken(oAuth2Client, callback);
      oAuth2Client.setCredentials(JSON.parse(token));
      callback(oAuth2Client);
    });
  }

  /**
   * Get and store new token after prompting for user authorization, and then
   * execute the given callback with the authorized OAuth2 client.
   * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
   * @param {getEventsCallback} callback The callback for the authorized client.
   */
  function getAccessToken(oAuth2Client, callback) {
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
        callback(oAuth2Client);
      });
    });
  }

  function storeFiles(auth) {
    // console.log("auth", JSON.stringify(auth));
    const drive = google.drive({ version: "v3", auth });
    var fileMetadata = {
      name: file,
    };
    var media = {
      mimeType: "application/zip",
      //PATH OF THE FILE FROM YOUR COMPUTER
      body: fs.createReadStream(`uploads/${file}`),
    };
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
          // console.log("File Id: ", file.data.id);
          // call here the callback which sends an email notification
          sendMessage(auth, file.data.id, name, callback);
        }
      }
    );
  }
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

function sendMessage(auth, fileId, name, callback) {
  // Using the js-base64 library for encoding:
  // https://www.npmjs.com/package/js-base64
  const downloadLink = `https://drive.google.com/uc?export=download&id=${fileId}`;
  const gmail = google.gmail({ version: "v1", auth });
  const raw = makeBody(
    process.env.EMAIL_RECIPIENT,
    process.env.EMAIL_SENDER,
    `${name} heeft nieuwe bestanden geupload`,
    uploadNotificationEmailBody(name, downloadLink)
  );
  gmail.users.messages.send(
    {
      userId: process.env.EMAIL_SENDER,
      resource: {
        raw,
      },
    },
    (err) => {
      if (err) return console.log(err);
      return callback(file);
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
        ${name} heeft nieuwe bestanden geüpload op je website. Hieronder vindt je de
        link om de zip folder met de bestanden te downloaden.
        <br><span style="display: block; margin: 32px 0;"><strong style="text-decoration: underline;">Let op:</strong> de link
          werkt alleen als je ingelogd bent in Google Drive of toegang hebt tot de
          gedeelde map
      </span></p>
  
      <table>
        <tr>
          <td><a class="btn" href=${downloadLink} style="font-size: 20px;color: #fff;line-height: 1em;margin: 1em 0;display: block;width: fit-content;padding: 0.75em 1em;cursor: pointer;outline: 0;border: 3px solid #007be0;border-radius: 32px;-webkit-border-radius: 32px;background-color: #007be0;text-decoration: none;text-transform: capitalize;box-shadow: 5px 5px 22px 0 rgba(0, 0, 0, 0.06);transition: background-color 0.25s ease-out, color 0.25s ease-out,
            border-color 0.25s ease-out;">Download bestanden</a></td>
          <td>
            <a class="link" href="https://accounts.google.com/signin/v2/identifier?service=wise&passive=true&continue=http%3A%2F%2Fdrive.google.com%2F%3Futm_source%3Dnl&utm_medium=button&utm_campaign=web&utm_content=gotodrive&usp=gtd&ltmpl=drive&flowName=GlifWebSignIn&flowEntry=ServiceLogin" style="font-size: 20px;color: #001010;line-height: 1em;margin: 1em 0;text-decoration: none;margin-left: 24px;">Login Drive
          </a></td>
        </tr>
      </table>
    </body>
  </html>
  `;
}

function formEntryEmailBody(data) {
  return `
  <html style="font-family: &quot;Lato&quot;;">
  <head>
    <link href="https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap" rel="stylesheet">
  </head>
  <body style="padding: 20px 30px;">
    <p style="font-size: 24px;font-weight: 700;color: #001010;line-height: 1.5em;margin: 1em 0;">Hallo Mathijs,</p>
    <p style="width: 500px;font-size: 20px;color: #001010;line-height: 1.5em;margin: 1em 0;">
      ${name} heeft nieuwe bestanden geüpload op je website. Hieronder vindt je de
      link om de zip folder met de bestanden te downloaden.
      <br><span style="display: block; margin: 32px 0;"><strong style="text-decoration: underline;">Let op:</strong> de link
        werkt alleen als je ingelogd bent in Google Drive of toegang hebt tot de
        gedeelde map
    </span></p>

    <table>
      <tr>
        <td><a class="btn" href=${downloadLink} style="font-size: 20px;color: #fff;line-height: 1em;margin: 1em 0;display: block;width: fit-content;padding: 0.75em 1em;cursor: pointer;outline: 0;border: 3px solid #007be0;border-radius: 32px;-webkit-border-radius: 32px;background-color: #007be0;text-decoration: none;text-transform: capitalize;box-shadow: 5px 5px 22px 0 rgba(0, 0, 0, 0.06);transition: background-color 0.25s ease-out, color 0.25s ease-out,
          border-color 0.25s ease-out;">Download bestanden</a></td>
        <td>
          <a class="link" href="https://accounts.google.com/signin/v2/identifier?service=wise&passive=true&continue=http%3A%2F%2Fdrive.google.com%2F%3Futm_source%3Dnl&utm_medium=button&utm_campaign=web&utm_content=gotodrive&usp=gtd&ltmpl=drive&flowName=GlifWebSignIn&flowEntry=ServiceLogin" style="font-size: 20px;color: #001010;line-height: 1em;margin: 1em 0;text-decoration: none;margin-left: 24px;">Login Drive
        </a></td>
      </tr>
    </table>
  </body>
</html>`;
}

module.exports = {
  uploadFiles,
  sendMessage,
};
