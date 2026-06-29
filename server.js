/**
 * cPanel Node.js Application Startup File
 * 
 * This file serves as the main entry point for Phusion Passenger in cPanel.
 * It imports and runs the compiled bundle located inside the 'dist' directory.
 */

try {
  // Load environment variables if .env file exists
  require('dotenv').config();
} catch (e) {
  // dotenv is optional in production if server-level env variables are configured
}

let loaded = false;
let rootError = null;
let distError = null;

try {
  console.log("Saint Francis Clinic Launcher: Attempting to initialize backend bundle from root (./server.cjs)...");
  require('./server.cjs');
  loaded = true;
  console.log("✅ Successfully loaded server.cjs from root!");
} catch (err) {
  rootError = err;
  console.log("ℹ️ Could not find or load server.cjs from root, trying dist (./dist/server.cjs)... Reason:", err.message);
  try {
    require('./dist/server.cjs');
    loaded = true;
    console.log("✅ Successfully loaded server.cjs from dist!");
  } catch (err2) {
    distError = err2;
    console.error("\n========================================================");
    console.error("CRITICAL ERROR: Unable to load production server bundle from either root or dist folder!");
    console.error("========================================================");
    console.error("Error (Root Path ./server.cjs):", err.stack || err.message);
    console.error("Error (Dist Path ./dist/server.cjs):", err2.stack || err2.message);
    console.error("\nPossibilities:");
    console.error("1. The application has not been compiled yet.");
    console.error("   -> Action: Run 'npm run build' from your terminal or cPanel JS Runner.");
    console.error("2. Node modules are not fully installed.");
    console.error("   -> Action: Run 'npm install' or click 'Run NPM Install' in cPanel.");
    console.error("========================================================\n");
  }
}

if (!loaded) {
  // Return a friendly fallback page if accessed before build
  const http = require('http');
  const server = http.createServer((req, res) => {
    res.writeHead(503, { 'Content-Type': 'text/html; charset=utf-8' });
    
    const rootErrorHtml = rootError ? `
      <div style="margin-top: 10px; background: #fff1f2; border: 1px solid #fecdd3; padding: 12px; border-radius: 6px; text-align: left;">
        <strong style="color: #be123c; font-size: 13px;">Error loading root bundle (./server.cjs):</strong>
        <pre style="margin: 5px 0 0 0; font-family: monospace; font-size: 12px; color: #9f1239; overflow-x: auto; white-space: pre-wrap; word-break: break-all;">${rootError.stack || rootError.message}</pre>
      </div>
    ` : '';

    const distErrorHtml = distError ? `
      <div style="margin-top: 10px; background: #fff1f2; border: 1px solid #fecdd3; padding: 12px; border-radius: 6px; text-align: left;">
        <strong style="color: #be123c; font-size: 13px;">Error loading dist bundle (./dist/server.cjs):</strong>
        <pre style="margin: 5px 0 0 0; font-family: monospace; font-size: 12px; color: #9f1239; overflow-x: auto; white-space: pre-wrap; word-break: break-all;">${distError.stack || distError.message}</pre>
      </div>
    ` : '';

    res.end(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Application Compilation Pending</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; color: #334155; padding: 20px; text-align: center; }
          .card { max-width: 650px; margin: 40px auto; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; }
          h2 { color: #0f172a; margin-top: 0; }
          code { background: #f1f5f9; padding: 3px 6px; border-radius: 4px; font-family: monospace; font-size: 13px; }
          .btn-group { margin-top: 25px; }
          .btn { display: inline-block; padding: 10px 20px; background: #059669; color: white; border-radius: 6px; text-decoration: none; font-weight: bold; }
          .diagnostics { margin-top: 25px; border-top: 1px solid #e2e8f0; padding-top: 20px; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>🩺 Saint Francis Clinic Portal</h2>
          <p>The application files have been uploaded, but the <strong>Production Build is pending</strong> or the server failed to initialize.</p>
          <p>Please enter your cPanel Node.js interface and complete these steps:</p>
          <div style="text-align: left; background: #fafafa; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px dashed #cbd5e1;">
            <ol style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.6;">
              <li>Click <strong>"Run NPM Install"</strong> in cPanel to load dependencies.</li>
              <li>Go to the <strong>"Run JS Script"</strong> dropdown, select <strong>"build"</strong>, and click run.</li>
              <li>Click <strong>"Restart"</strong> at the top of the Setup Node.js App page.</li>
            </ol>
          </div>
          <p>Once compiled and running successfully, this loading screen will automatically be replaced by the live clinic management dashboard.</p>
          
          <div class="diagnostics">
            <h4 style="margin: 0 0 10px 0; color: #475569; text-align: left; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em;">🔍 Server Diagnostic Logs</h4>
            ${rootErrorHtml}
            ${distErrorHtml}
            ${!rootError && !distError ? '<p style="text-align: left; font-size: 13px; color: #64748b; margin: 5px 0;">No active logs captured. Ensure that server.js is running in cPanel node.js.</p>' : ''}
          </div>
        </div>
      </body>
      </html>
    `);
  });
  
  const port = process.env.PORT || 3000;
  server.listen(port);
}
