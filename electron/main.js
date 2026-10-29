import { app, BrowserWindow } from 'electron';
import process from 'node:process';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let serverProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  const isDev = !app.isPackaged;

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

function startBackendServer() {
  const isDev = !app.isPackaged;
  const serverPath = isDev 
    ? path.join(__dirname, '../server/index.js')
    : path.join(process.resourcesPath, 'server/index.js');
    
  console.log('Starting internal Express server at:', serverPath);
  
  serverProcess = spawn('node', [serverPath], {
    env: { ...process.env, PORT: 3001 }
  });

  serverProcess.stdout.on('data', (data) => {
    console.log(`Backend Server: ${data}`);
  });

  serverProcess.stderr.on('data', (data) => {
    console.error(`Backend Server Error: ${data}`);
  });
}

app.on('ready', () => {
  startBackendServer();
  createWindow();
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', function () {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('quit', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
});
