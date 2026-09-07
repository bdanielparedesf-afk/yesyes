const { execSync } = require('child_process');
const port = process.argv[2] || '3001';
try {
  const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
  const pids = [...new Set((out.match(/\d+\s*$/gm) || []).map(s => s.trim()))].filter(Boolean);
  pids.forEach(pid => {
    try {
      execSync(`taskkill /F /PID ${pid}`);
      console.log(`Killed PID ${pid} on port ${port}`);
    } catch {}
  });
} catch {}