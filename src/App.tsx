import { useState } from 'react';
import { Search, Camera, Check, Smartphone, Phone, DollarSign, Lock, Calendar } from 'lucide-react';
import sha256 from 'crypto-js/sha256';
import { Scanner } from './components/Scanner';

interface DeviceInfo {
  tac?: string;
  shortIMEI?: string;
  gsmaModelName?: string;
  gsmaManufacturer?: string;
  gsmaBrandName?: string;
  gsmaAllocationDate?: string;
}

interface ImeiCheck {
  paymentState?: string;
  blockState?: string;
  endOfGracePeriod?: string | null;
  canPay?: boolean;
  severalImei?: number;
  IMEI?: string;
  Incorrect?: boolean;
}

export default function App() {
  const [imei, setImei] = useState('');
  const [loading, setLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    device?: DeviceInfo;
    check?: ImeiCheck;
  } | null>(null);

  const solveAltcha = (challenge: string, salt: string, maxnumber: number): number | null => {
    for (let n = 0; n <= maxnumber; n++) {
      const hash = sha256(salt + n).toString();
      if (hash === challenge) return n;
    }
    return null;
  };

  const handleCheck = async () => {
    if (!imei || imei.length < 14) {
      setError('IMEI နံပါတ် အမှန်ထည့်ပေးပါ။');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const start = Date.now();
      
      // 1. Get Altcha challenge
      const authRes = await fetch('https://ceir.gov.mm/openapi/API/Auth/altcha/altcha', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36',
          'Accept': 'application/json, text/plain, */*'
        }
      });

      if (!authRes.ok) {
        if (authRes.status === 403) {
            throw new Error('ချိတ်ဆက်မှု မအောင်မြင်ပါ (403): မြန်မာနိုင်ငံတွင်းမှသာ အသုံးပြုနိုင်ပါသည်။ VPN အသုံးပြုထားပါက ပိတ်ပေးပါ။');
        }
        throw new Error(`ချိတ်ဆက်မှု မအောင်မြင်ပါ (Status: ${authRes.status})`);
      }
      const authData = await authRes.json();

      // 2. Solve challenge (in setTimeout to allow UI to render loading state)
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const { algorithm, challenge, salt, signature, maxnumber } = authData;
      const number = solveAltcha(challenge, salt, maxnumber);

      if (number === null) {
        throw new Error('Failed to solve verification challenge');
      }

      const took = Date.now() - start;

      const altchaPayload = {
        algorithm,
        challenge,
        number,
        salt,
        signature,
        took
      };

      const altchaBase64 = btoa(JSON.stringify(altchaPayload));

      // 3. Check IMEI and Device Info in parallel
      const [verifyRes, infoRes] = await Promise.all([
        fetch(`https://ceir.gov.mm/openapi/API/IMEI/Verify?altcha=${altchaBase64}&imei=${imei}`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36',
            'Accept': 'application/json, text/plain, */*'
          }
        }),
        fetch(`https://ceir.gov.mm/openapi/API/Device/personal-device-info?altcha=${altchaBase64}&imei=${imei}`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36',
            'Accept': 'application/json, text/plain, */*'
          }
        })
      ]);

      let checkData: any = {};
      let infoData: any = {};

      if (verifyRes.ok) {
         const json = await verifyRes.json();
         if (json.IMEI_CHECK_LIST && json.IMEI_CHECK_LIST.length > 0) {
            checkData = json.IMEI_CHECK_LIST[0];
         }
      }

      if (infoRes.ok) {
         infoData = await infoRes.json();
      }

      setResult({
        check: checkData,
        device: infoData
      });
      
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'စစ်ဆေးနေစဉ် အမှားအယွင်းဖြစ်ပေါ်ခဲ့ပါသည်။');
    } finally {
      setLoading(false);
    }
  };

  const getTaxStatus = (paymentState?: string) => {
    if (paymentState === 'ACCUMULATION') return { label: 'Free Pass ဖုန်း', color: 'text-blue-400' };
    if (paymentState === 'PAID') return { label: 'အခွန်ဆောင်ပြီး', color: 'text-green-400' };
    if (paymentState === 'UNPAID') return { label: 'အခွန်မဆောင်ရသေးပါ', color: 'text-red-400' };
    return { label: paymentState || 'မသိရပါ', color: 'text-gray-400' };
  };

  const getBlockStatus = (blockState?: string) => {
    if (blockState === 'UNBLOCKED') return { label: 'ပိတ်မထားပါ', color: 'text-green-400' };
    if (blockState === 'BLOCKED') return { label: 'ပိတ်ထားပါသည်', color: 'text-red-400' };
    return { label: blockState || 'မသိရပါ', color: 'text-gray-400' };
  };

  return (
    <div className="min-h-screen bg-[#121212] text-white p-6 font-sans">
      <div className="max-w-md mx-auto space-y-6">
        
        <header className="pt-8">
          <h1 className="text-3xl font-bold text-white mb-2">CEIR IMEI Check</h1>
          <p className="text-gray-400 text-sm mb-4">IMEI စစ်ဆေးခြင်း</p>
        </header>

        <div className="space-y-4">
          <div className="relative">
            <input 
              type="text" 
              value={imei}
              onChange={(e) => setImei(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="IMEI ထည့်ပါ"
              className="w-full bg-[#1e1e24] border border-gray-700 rounded-xl px-4 py-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 transition-shadow"
            />
            <button 
              onClick={() => setShowScanner(true)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-white transition-colors"
            >
              <Camera size={20} />
            </button>
          </div>

          <button 
            onClick={handleCheck}
            disabled={loading || !imei}
            className="w-full bg-[#2f8d46] hover:bg-[#267a3a] disabled:opacity-70 disabled:cursor-not-allowed text-white rounded-xl py-4 px-4 flex items-center justify-center space-x-2 font-medium transition-colors"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Search size={18} />
                <span>စစ်ဆေးရန်</span>
              </>
            )}
          </button>
          
          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}
        </div>

        {result && (
          <div className="mt-8 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center text-green-400 font-medium space-x-2">
              <Check size={18} />
              <span>Done</span>
            </div>

            <div className="bg-[#1e1e24] rounded-xl border border-gray-800 overflow-hidden text-sm">
              <div className="grid grid-cols-[140px_1fr] border-b border-gray-800 bg-[#25252c] p-4 text-gray-400 font-medium">
                <div>အကြောင်းအရာ</div>
                <div>ရလဒ်</div>
              </div>
              
              <div className="divide-y divide-gray-800/50">
                <div className="grid grid-cols-[140px_1fr] p-4 items-center">
                  <div className="flex items-center text-gray-300 space-x-2">
                    <Smartphone size={16} className="text-gray-500" />
                    <span>IMEI</span>
                  </div>
                  <div className="text-white break-all">{imei}</div>
                </div>

                <div className="grid grid-cols-[140px_1fr] p-4 items-center">
                  <div className="flex items-center text-gray-300 space-x-2">
                    <Phone size={16} className="text-gray-500" />
                    <span>Device</span>
                  </div>
                  <div className="text-white">
                    {result.device?.gsmaBrandName} {result.device?.gsmaModelName}
                  </div>
                </div>

                <div className="grid grid-cols-[140px_1fr] p-4 items-center">
                  <div className="flex items-center text-gray-300 space-x-2">
                    <DollarSign size={16} className="text-gray-500" />
                    <span>အခွန်</span>
                  </div>
                  <div className={getTaxStatus(result.check?.paymentState).color}>
                    {getTaxStatus(result.check?.paymentState).label}
                  </div>
                </div>

                <div className="grid grid-cols-[140px_1fr] p-4 items-center">
                  <div className="flex items-center text-gray-300 space-x-2">
                    <Lock size={16} className="text-gray-500" />
                    <span>ဖုန်းလိုင်း</span>
                  </div>
                  <div className={getBlockStatus(result.check?.blockState).color}>
                    {getBlockStatus(result.check?.blockState).label}
                  </div>
                </div>

                <div className="grid grid-cols-[140px_1fr] p-4 items-center">
                  <div className="flex items-center text-gray-300 space-x-2">
                    <Calendar size={16} className="text-gray-500" />
                    <span>လိုင်းပိတ်မည့်ရက်</span>
                  </div>
                  <div className="text-white">
                    {result.check?.endOfGracePeriod ? result.check.endOfGracePeriod : 'မရှိ'}
                  </div>
                </div>
              </div>
            </div>

            {result.check?.paymentState === 'ACCUMULATION' && (
              <div className="bg-[#1e1e24] rounded-xl border border-blue-900/50 p-5 mt-4">
                <div className="flex items-center space-x-2 text-blue-400 font-medium mb-2">
                  <Smartphone size={16} />
                  <span>Free Pass ဖုန်း</span>
                </div>
                <p className="text-gray-400 text-sm leading-relaxed">
                  ယခုဖုန်းသည် April လအရှေ့မှာ free pass အနေနဲ့ စာရင်းဝင်ထားသောဖုန်းဖြစ်ပါသည်။
                </p>
              </div>
            )}
          </div>
        )}

      </div>
      
      {showScanner && (
        <Scanner 
          onScan={(text) => {
            setImei(text.replace(/[^0-9]/g, ''));
            setShowScanner(false);
          }}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  );
}
