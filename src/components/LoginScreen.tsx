import { useState } from 'react';
import { TEAM_MEMBERS, getLevelTier } from '../data/gameData';
import type { TeamMember } from '../types';
import { getStoredPinHash, setPinHash, verifyPin } from '../lib/supabase';

type LoginStep = 'pick' | 'pin' | 'set_pin' | 'confirm_pin' | 'checking';

interface LoginScreenProps {
  onLogin: (memberId: string) => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [step, setStep] = useState<LoginStep>('pick');
  const [selected, setSelected] = useState<TeamMember | null>(null);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSelectMember = async (member: TeamMember) => {
    setSelected(member);
    setPin('');
    setConfirmPin('');
    setError('');
    setLoading(true);
    setStep('checking');

    const existing = await getStoredPinHash(member.id);
    setLoading(false);

    if (existing) {
      setStep('pin');
    } else {
      setStep('set_pin');
    }
  };

  const handlePinDigit = (digit: string) => {
    if (step === 'pin') {
      const next = pin + digit;
      if (next.length <= 4) {
        setPin(next);
        if (next.length === 4) handleVerifyPin(next);
      }
    } else if (step === 'set_pin') {
      const next = pin + digit;
      if (next.length <= 4) {
        setPin(next);
        if (next.length === 4) setStep('confirm_pin');
      }
    } else if (step === 'confirm_pin') {
      const next = confirmPin + digit;
      if (next.length <= 4) {
        setConfirmPin(next);
        if (next.length === 4) handleSetPin(pin, next);
      }
    }
  };

  const handleBackspace = () => {
    if (step === 'pin') setPin(p => p.slice(0, -1));
    else if (step === 'set_pin') setPin(p => p.slice(0, -1));
    else if (step === 'confirm_pin') setConfirmPin(p => p.slice(0, -1));
    setError('');
  };

  const handleVerifyPin = async (enteredPin: string) => {
    setLoading(true);
    setError('');
    const ok = await verifyPin(selected!.id, enteredPin);
    setLoading(false);
    if (ok) {
      onLogin(selected!.id);
    } else {
      setPin('');
      setError('Wrong PIN. Try again.');
    }
  };

  const handleSetPin = async (newPin: string, confirmValue: string) => {
    if (newPin !== confirmValue) {
      setConfirmPin('');
      setError("PINs don't match. Try again.");
      setStep('set_pin');
      setPin('');
      return;
    }
    setLoading(true);
    await setPinHash(selected!.id, newPin);
    setLoading(false);
    onLogin(selected!.id);
  };

  const currentPin = step === 'confirm_pin' ? confirmPin : pin;

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center"
      style={{ background: 'linear-gradient(135deg, #080814 0%, #0d1117 50%, #080814 100%)', color: '#e2e8f0' }}
    >
      {/* Logo */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-black text-3xl mb-4"
          style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', boxShadow: '0 0 40px rgba(99,102,241,0.5)' }}>D</div>
        <div className="text-3xl font-black tracking-tight text-white">DOME</div>
        <div className="text-sm text-indigo-400 tracking-widest uppercase font-medium mt-1">Mission Control</div>
      </div>

      {/* Step: Pick user */}
      {step === 'pick' && (
        <div className="flex flex-col items-center w-full px-6 max-w-lg">
          <div className="text-gray-400 text-sm mb-6">Who are you?</div>
          <div className="grid grid-cols-4 gap-3 w-full">
            {TEAM_MEMBERS.map(member => {
              const tier = getLevelTier(member.level);
              return (
                <button key={member.id} onClick={() => handleSelectMember(member)}
                  className="flex flex-col items-center gap-2 p-3 rounded-2xl transition-all duration-150 hover:scale-105"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '2px solid rgba(255,255,255,0.06)' }}>
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-black relative"
                    style={{ background: `radial-gradient(circle at 35% 35%, ${member.avatarAccent}, ${member.avatarColor})`, boxShadow: `0 0 16px ${member.avatarColor}88` }}>
                    {member.name[0]}
                    <div className="absolute -bottom-1 -right-1 text-[9px] font-black px-1 py-0.5 rounded-full"
                      style={{ background: tier.color, color: '#000' }}>{member.level}</div>
                  </div>
                  <div className="text-xs font-bold text-white">{member.name}</div>
                  <div className="text-[9px] text-gray-500 leading-tight text-center">{member.role}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Step: Checking / Loading */}
      {step === 'checking' && (
        <div className="flex flex-col items-center gap-4">
          <MemberBadge member={selected!} />
          <div className="text-gray-400 text-sm animate-pulse">Checking credentials...</div>
        </div>
      )}

      {/* Step: Enter PIN */}
      {(step === 'pin' || step === 'set_pin' || step === 'confirm_pin') && selected && (
        <div className="flex flex-col items-center gap-6">
          <MemberBadge member={selected} />

          <div className="text-center">
            <div className="text-white font-semibold text-lg">
              {step === 'pin' && `Welcome back, ${selected.name}`}
              {step === 'set_pin' && `Create your PIN, ${selected.name}`}
              {step === 'confirm_pin' && 'Confirm your PIN'}
            </div>
            <div className="text-gray-500 text-sm mt-1">
              {step === 'pin' && 'Enter your 4-digit PIN'}
              {step === 'set_pin' && 'Choose a 4-digit PIN'}
              {step === 'confirm_pin' && 'Enter it one more time'}
            </div>
          </div>

          {/* PIN dots */}
          <div className="flex gap-4">
            {[0,1,2,3].map(i => (
              <div key={i} className="w-5 h-5 rounded-full border-2 transition-all duration-150"
                style={{
                  borderColor: currentPin.length > i ? selected.avatarColor : 'rgba(255,255,255,0.2)',
                  background: currentPin.length > i ? selected.avatarColor : 'transparent',
                  boxShadow: currentPin.length > i ? `0 0 10px ${selected.avatarColor}88` : 'none',
                }} />
            ))}
          </div>

          {error && <div className="text-red-400 text-sm text-center">{error}</div>}

          {loading && <div className="text-gray-400 text-sm animate-pulse">Verifying...</div>}

          {/* Number pad */}
          {!loading && (
            <div className="grid grid-cols-3 gap-3 w-56">
              {[1,2,3,4,5,6,7,8,9].map(n => (
                <button key={n} onClick={() => handlePinDigit(String(n))}
                  className="h-14 rounded-2xl text-white text-xl font-bold transition-all duration-100 active:scale-95"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  {n}
                </button>
              ))}
              <button onClick={() => { setStep('pick'); setPin(''); setConfirmPin(''); setError(''); }}
                className="h-14 rounded-2xl text-gray-500 text-sm transition-all duration-100 active:scale-95"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                ←
              </button>
              <button onClick={() => handlePinDigit('0')}
                className="h-14 rounded-2xl text-white text-xl font-bold transition-all duration-100 active:scale-95"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                0
              </button>
              <button onClick={handleBackspace}
                className="h-14 rounded-2xl text-gray-400 text-lg transition-all duration-100 active:scale-95"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                ⌫
              </button>
            </div>
          )}
        </div>
      )}

      <div className="mt-10 text-gray-600 text-xs">DOME Team · Internal Tool</div>
    </div>
  );
}

function MemberBadge({ member }: { member: TeamMember }) {
  const tier = getLevelTier(member.level);
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="w-20 h-20 rounded-full flex items-center justify-center text-white text-3xl font-black"
        style={{ background: `radial-gradient(circle at 35% 35%, ${member.avatarAccent}, ${member.avatarColor})`, boxShadow: `0 0 30px ${member.avatarColor}88` }}>
        {member.name[0]}
      </div>
      <div className="text-white font-bold text-lg">{member.name}</div>
      <div className="text-xs px-3 py-1 rounded-full font-medium" style={{ background: `${tier.color}22`, color: tier.color, border: `1px solid ${tier.color}44` }}>
        Lv{member.level} · {member.role}
      </div>
    </div>
  );
}
