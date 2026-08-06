import { Html5QrcodeScanner } from 'html5-qrcode';
import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export function Scanner({ onScan, onClose }: { onScan: (result: string) => void, onClose: () => void }) {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    scannerRef.current = new Html5QrcodeScanner(
      "qr-reader",
      { fps: 10, qrbox: { width: 250, height: 250 }, formatsToSupport: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] },
      false
    );
    
    scannerRef.current.render((text) => {
      onScan(text);
      if (scannerRef.current) {
         scannerRef.current.clear().catch(e => console.error(e));
      }
    }, () => {});

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(e => console.error("Failed to clear scanner", e));
      }
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#1e1e24] rounded-2xl overflow-hidden shadow-2xl relative">
        <div className="flex justify-between items-center p-4 border-b border-gray-800">
          <h2 className="text-white font-medium">Scan IMEI Barcode</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>
        
        <div className="p-4 bg-black">
          <div id="qr-reader" className="w-full mx-auto" style={{ maxWidth: '400px' }}></div>
        </div>
      </div>
    </div>
  );
}
