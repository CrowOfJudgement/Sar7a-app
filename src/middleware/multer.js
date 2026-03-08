import multer from 'multer';
import fs from 'fs';
import path from 'path';

const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

export const multer_local = ({ custom_types = [] } = {}) => {
    const storage = multer.diskStorage({
        destination: function (req, file, cb) {
            cb(null, 'uploads/') 
        },
        filename: function (req, file, cb) {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
            cb(null, file.fieldname + '-' + uniqueSuffix + "-" + file.originalname)
        }
    });

    const fileFilter = (req, file, cb) => {
        if (custom_types.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("Invalid file type "), false);
        }
    };

    return multer({ storage, fileFilter });
};