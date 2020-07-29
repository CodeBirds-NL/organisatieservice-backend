require("dotenv").config(); // configure env variables

const express = require("express");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");
const archiver = require("archiver");
const {
  uploadFiles,
  handleFormEntry,
  sendErrorNotification,
} = require("./uploadFiles");

/* INITIAL CONFIG */
const app = express();
app.use(cors());
app.use(express.json()); // parse

/* Set up tmp folder */
const dir = "./tmp";
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir);
}

/* MULTER STORAGE CONFIG */
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const name = req.body.name.toLowerCase();

    //create new directory in tmp with clients name as dirname
    fs.mkdir(`tmp/${name}`, (err) => {
      if (err) return;
    });
    // then do callback which sets destination to made up string
    cb(null, `tmp/${name}`);
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});
const upload = multer({ storage: storage });

/* ROUTES */

// upload route
app.post("/upload", upload.array("images"), (req, res) => {
  let error = false;
  let name = req.body.name.toLowerCase();
  let project = req.body.project.toLowerCase();
  const uploadDir = `${__dirname}/tmp/`;
  // create zip file in uploads dir with clients name as filename
  const output = fs.createWriteStream(`${uploadDir + name}.zip`);
  const archive = archiver("zip", {
    zlib: { level: 9 },
  });

  const handleErrorNotification = () => {
    let data = {
      name,
      project,
      files: req.images,
      date: new Date().toLocaleString("nl-NL", {
        timeZone: "Europe/Amsterdam",
      }),
    };
    sendErrorNotification(data);
  };

  archive.on("warning", function (err) {
    error = true;
    handleErrorNotification();

    if (err.code === "ENOENT") {
      // log warning
      console.log(err);
    } else {
      // throw error
      throw err;
    }
  });

  archive.on("error", (err) => {
    error = true;
    return handleErrorNotification();
  });

  archive.pipe(output);

  // listen when writing stream is stopped, then remove the readingstream directory
  // we put this listener before the .finalize listener to prevent uncaught events
  output.on("finish", () => {
    // only zip with client_name with be left in uploads folder, ready to be shoot to google drive
    if (!error) {
      fs.rmdir(`tmp/${name}`, { recursive: true }, () => {
        console.log("local dir successfully deleted");
      });
    } else return;

    // upload zip to google drive, then delete zip file
    uploadFiles(name, project, req.body.name, () => {
      // this will delete the zip file
      fs.unlink(`${uploadDir + name}.zip`, (err) => {
        if (err) throw err;
        console.log("zip file deleted, Google Drive upload successfull.");
        // send success response
      });
      res.json("success");
    });
  });

  // get all files in uploads/client_name and pipe them to tmp/client_name.zip
  archive.directory(`${uploadDir + name}`, false).finalize();
});

// form entry route
app.post("/directactie", function (req, res) {
  // 1. generate emailbody with fields from req.body
  handleFormEntry(req.body, () => {
    res.json("success");
  });
});

const port = process.env.PORT;
app.listen(port, () => {
  console.log(`Running on port ${port}`);
});
