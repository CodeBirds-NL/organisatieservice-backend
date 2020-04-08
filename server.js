require("dotenv").config(); // configure env variables

const express = require("express");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");
const archiver = require("archiver");
const { uploadFiles, sendMessage } = require("./uploadFiles");

/* INITIAL CONFIG */
const app = express();
app.use(cors());
app.use(express.json()); // parse

/* MULTER STORAGE CONFIG */
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const name = req.body.name.toLowerCase().split(" ").join("");
    const dirStr = `uploads/${name}`;
    //create new directory in uploads with clients name as dirname
    fs.mkdir(dirStr, (err) => {
      if (err) return;
    });
    // then do callback which sets destination to made up string
    cb(null, dirStr);
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});
const upload = multer({ storage: storage });

/* ROUTES */
app.post("/upload", upload.array("images"), (req, res) => {
  let name = req.body.name.toLowerCase().split(" ").join("");
  const uploadDir = `${__dirname}/uploads/`;
  // create zip file in uploads dir with clients name as filename
  const output = fs.createWriteStream(`${uploadDir + name}.zip`);
  const archive = archiver("zip", {
    zlib: { level: 9 },
  });

  archive.on("error", (err) => {
    throw err;
  });

  archive.pipe(output);

  // listen when writing stream is stopped, then remove the readingstream directory
  // we put this listener before the .finalize listener to prevent uncaught events
  output.on("finish", () => {
    // only zip with client_name with be left in uploads folder, ready to be shoot to google drive
    fs.rmdir(`uploads/${name}`, { recursive: true }, () => {
      console.log(name + " dir successfully deleted");
    });

    // send success response
    res.json("success");

    // upload zip to google drive, then delete zip file
    uploadFiles(`${name}.zip`, req.body.name, (file) => {
      // this will delete the zip file
      fs.unlink(uploadDir + file, (err) => {
        if (err) throw err;
        return;
      });
    });
  });

  // get all files in uploads/client_name and pipe them to uploads/client_name.zip
  archive.directory(`${uploadDir + name}`, false).finalize();
});

app.post("/directactie", function (req, res) {
  console.log(req.body);
  res.json("success");
});

app.listen(3001, () => {
  console.log(`Running on port 3001`);
});
