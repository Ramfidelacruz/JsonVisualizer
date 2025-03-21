import { useEffect, useRef } from 'react';
import monaco from '../monaco-setup';

const JsonEditor = ({ jsonData, onChange }) => {
  const editorRef = useRef(null);
  const monacoEditorRef = useRef(null);

  useEffect(() => {
    if (editorRef.current) {
      // Intentar crear el editor con manejo de errores
      try {
        const editor = monaco.editor.create(editorRef.current, {
          value: JSON.stringify(jsonData, null, 2),
          language: 'json',
          theme: 'vs-dark',
          automaticLayout: true,
          minimap: {
            enabled: false
          },
          scrollBeyondLastLine: false,
          fontSize: 14,
          lineNumbers: 'on',
          renderLineHighlight: 'all',
          cursorBlinking: 'smooth',
        });

        monacoEditorRef.current = editor;

        // Añadir un delay para evitar actualizaciones constantes
        let timeout;
        editor.onDidChangeModelContent(() => {
          clearTimeout(timeout);
          timeout = setTimeout(() => {
            try {
              const editorContent = editor.getValue();
              const parsedJson = JSON.parse(editorContent);
              onChange(parsedJson);
            } catch (e) {
              // JSON inválido - no actualizar
              console.error('JSON inválido:', e.message);
            }
          }, 300);
        });

        return () => {
          editor.dispose();
        };
      } catch (error) {
        console.error("Error al inicializar Monaco Editor:", error);
      }
    }
  }, []);

  // Actualiza el editor si jsonData cambia externamente
  useEffect(() => {
    if (monacoEditorRef.current) {
      const currentValue = monacoEditorRef.current.getValue();
      const newValue = JSON.stringify(jsonData, null, 2);
      
      if (currentValue !== newValue) {
        monacoEditorRef.current.setValue(newValue);
      }
    }
  }, [jsonData]);

  return <div ref={editorRef} style={{ width: '100%', height: '100%' }} />;
};

export default JsonEditor; 

// Solución alternativa para Monaco Editor
self.MonacoEnvironment = {
  baseUrl: '.',
  getWorkerUrl: function (moduleId, label) {
    if (label === 'json') {
      return './monaco-editor/json.worker.js';
    }
    return './monaco-editor/editor.worker.js';
  }
};