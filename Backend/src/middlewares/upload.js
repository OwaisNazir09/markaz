const multer = require("multer");
const ftp = require("basic-ftp");
const path = require("path");
const uniqid = require("uniqid");

class MulterFTPStorage {
  constructor(options = {}) {
    this.options = options;
  }

  _handleFile(req, file, cb) {
    const client = new ftp.Client();
    const { ftpConfig, destination, allowedTypes = [] } = this.options;
    if (allowedTypes.length && !allowedTypes.includes(file.mimetype)) {
      return cb({
        code: "INVALID_FILE_TYPE",
        errormessage: "Invalid file type",
      });
    }

    destination(req, file, async (err, uploadPath) => {
      if (err) return cb(err);
      const dir = path.posix.dirname(uploadPath);

      try {
        await client.access({
          host: ftpConfig.host,
          user: ftpConfig.user,
          password: ftpConfig.password,
          secure: false,
        });

        await client.ensureDir(dir);

        await client.uploadFrom(file.stream, uploadPath);

        client.close();

        cb(null, {
          path: uploadPath,
          filename: path.basename(uploadPath),
        });

      } catch (ftpErr) {
        client.close();
        console.error("FTP Upload Error:", ftpErr);
        cb(ftpErr);
      }
    });
  }

  _removeFile(req, file, cb) {
    const client = new ftp.Client();
    const { ftpConfig } = this.options;

    (async () => {
      try {
        await client.access({
          host: ftpConfig.host,
          user: ftpConfig.user,
          password: ftpConfig.password,
          secure: false,
        });

        await client.remove(file.path);
        client.close();
        cb(null);
      } catch (err) {
        client.close();
        cb(err);
      }
    })();
  }
}

const createUploader = (key) => {
  const uploadConfig = require("../config/upload.config")[key];
  const ftpConfig = require("../config/ftp.config");

  if (!uploadConfig) throw new Error("Invalid upload config key");

  const storage = new MulterFTPStorage({
    ftpConfig: {
      host: ftpConfig.host,
      user: ftpConfig.user,
      password: ftpConfig.password,
    },

    allowedTypes: uploadConfig.allowedTypes,

    destination(req, file, cb) {
      const cleanName = path.parse(file.originalname).name.replace(/\s+/g, "_");

      const filename =
        cleanName + "_" + uniqid() + path.extname(file.originalname);

      cb(null, `${uploadConfig.folder}/${filename}`);
    },
  });

  const upload = multer({
    storage,
    limits: { fileSize: uploadConfig.maxSize },
  });

  if (uploadConfig.fields) {
    return upload.fields(uploadConfig.fields);
  }

  if (uploadConfig.field) {
    return upload.array(uploadConfig.field, uploadConfig.maxCount || 1);
  }

  return upload.any();
};

module.exports = createUploader;
