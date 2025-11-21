declare module 'compression';
declare module 'morgan';
declare module 'cookie-session';
declare module 'multer';
declare module 'pdfkit';
declare module 'blueimp-md5';
declare module 'react-dom/client';
declare module '@vitejs/plugin-react';

declare namespace Express {
  namespace Multer {
    interface File {
      fieldname: string;
      originalname: string;
      encoding: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
      [key: string]: any;
    }
  }
}
