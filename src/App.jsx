import { useState } from 'react';
import JsonEditor from './components/JsonEditor';
import DiagramView from './components/DiagramView';
import StatsBar from './components/StatsBar';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import './App.css';

function App() {
  const [jsonData, setJsonData] = useState(initialJson);
  
  const handleJsonChange = (newJsonData) => {
    try {
      setJsonData(newJsonData);
    } catch (error) {
      console.error("Error al actualizar JSON:", error);
    }
  };

  // Función para cargar JSON desde archivo
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = JSON.parse(e.target.result);
          setJsonData(content);
        } catch (error) {
          console.error("Error al parsear el archivo JSON:", error);
          alert("El archivo no contiene un JSON válido");
        }
      };
      reader.readAsText(file);
    }
  };

  // Función para exportar JSON a archivo
  const handleExport = () => {
    const jsonString = JSON.stringify(jsonData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'data.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-screen flex flex-col bg-black text-white">
      <header className="bg-gray-900 p-2 flex items-center justify-between border-b border-gray-800">
        <h1 className="text-xl font-bold">Visualizador de JSON</h1>
        <div className="flex items-center gap-2">
          <input
            type="file"
            id="file-upload"
            accept=".json"
            onChange={handleFileUpload}
            className="hidden"
          />
          <label
            htmlFor="file-upload"
            className="px-3 py-1 bg-blue-600 rounded-md text-sm hover:bg-blue-700 cursor-pointer"
          >
            Importar JSON
          </label>
          <button
            onClick={handleExport}
            className="px-3 py-1 bg-gray-700 rounded-md text-sm hover:bg-gray-600"
          >
            Exportar
          </button>
        </div>
      </header>
      
      <PanelGroup direction="horizontal" className="flex-grow">
        <Panel defaultSize={40} minSize={20}>
          <div className="h-full flex flex-col">
            <div className="p-2 bg-gray-800 text-sm">Editor JSON</div>
            <div className="flex-grow">
              <JsonEditor jsonData={jsonData} onChange={handleJsonChange} />
            </div>
            <StatsBar jsonData={jsonData} />
          </div>
        </Panel>
        
        <PanelResizeHandle className="w-1 bg-gray-800 hover:bg-blue-600 cursor-col-resize" />
        
        <Panel defaultSize={60} minSize={30}>
          <div className="h-full flex flex-col">
            <div className="p-2 bg-gray-800 text-sm">Visualización</div>
            <div className="flex-grow">
              <DiagramView jsonData={jsonData} />
            </div>
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
}

// JSON inicial basado en la imagen proporcionada
const initialJson = {
  "fruits": [
    {
      "name": "Apple",
      "color": "Red",
      "nutrients": {
        "calories": 52,
        "fiber": "2.4g",
        "vitaminC": "4.6mg"
      }
    },
    {
      "name": "Banana",
      "color": "Yellow",
      "nutrients": {
        "calories": 89,
        "fiber": "2.6g",
        "potassium": "358mg"
      }
    },
    {
      "name": "Orange",
      "color": "Orange",
      "nutrients": {
        "calories": 47,
        "fiber": "2.4g",
        "vitaminC": "53.2mg"
      }
    }
  ]
};

export default App;
