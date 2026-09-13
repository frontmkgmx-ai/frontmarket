const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const search = `  app.listen(PORT, "0.0.0.0", () => {
    console.log(\`Server running on http://localhost:\${PORT}\`);
  });
}`;

const replace = `  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(\`Server running on http://localhost:\${PORT}\`);
  });

  // Graceful shutdown
  const gracefulShutdown = () => {
    console.log('Recebido sinal de interrupção, iniciando graceful shutdown...');
    server.close(() => {
      console.log('Processo encerrado com segurança.');
      process.exit(0);
    });
    
    // Timeout para forçar o encerramento se demorar muito
    setTimeout(() => {
      console.error('Forçando encerramento após timeout.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
}`;

if (code.includes(search)) {
  code = code.replace(search, replace);
}

fs.writeFileSync('server.ts', code);
