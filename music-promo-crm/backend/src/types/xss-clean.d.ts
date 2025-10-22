declare module 'xss-clean' {
  import { RequestHandler } from 'express';
  
  interface XssCleanOptions {
    // Add any options here if needed
  }
  
  function xssClean(options?: XssCleanOptions): RequestHandler;
  
  export = xssClean;
}
