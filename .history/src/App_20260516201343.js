import React, { useState, useEffect } from 'react';
import { Clock, Play, CheckSquare, Coffee, DollarSign, AlertCircle, Timer, X, History, Search, Grid } from 'lucide-react';
import SeatMap from './SeatMap';
import DraggableSessionCard from './DraggableSessionCard';

const STORAGE_SESSIONS_KEY = 'jifei_sessions';
const STORAGE_RATE_KEY = 'jifei_hourly_rate';
const STORAGE_SEATS_KEY = 'jifei_seats_layout';
const DEFAULT_HOURLY_RATE = 9.9;

const loadSessions = () => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_SESSIONS_KEY);
    const sessions = raw ? JSON.parse(raw) : [];
    // 确保所有session有坐位号和 groupMembers 属性（兼容旧数据）
    return sessions.map((session) => ({
      ...session,
      seatNumber: session.seatNumber || session.phoneTail || '',
      groupMembers:
        session.groupMembers ||
        (session.seatNumber || session.phoneTail ? [session.seatNumber || session.phoneTail] : []),
      customerName: session.customerName || '',
      contactPhone: session.contactPhone || '',
      partySize: session.partySize || 1,
    }));
  } catch (error) {
    console.error('Load sessions error:', error);
    return [];
  }
};

const loadHourlyRate = () => {
  if (typeof window === 'undefined') return DEFAULT_HOURLY_RATE;
  const saved = localStorage.getItem(STORAGE_RATE_KEY);
  const rate = saved ? parseFloat(saved) : DEFAULT_HOURLY_RATE;
  return isNaN(rate) || rate <= 0 ? DEFAULT_HOURLY_RATE : rate;
};

// 修复预览环境偶发的 tailwind is not defined 错误
if (typeof window !== 'undefined') {
  window.tailwind = window.tailwind || { config: {} };
}

export default function App() {
  const [sessions, setSessions] = useState(loadSessions);
  const [now, setNow] = useState(Date.now());
  const [seatNumber, setSeatNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [partySize, setPartySize] = useState('1');
  const [groupTails, setGroupTails] = useState('');
  const [duration, setDuration] = useState('');
  const [prepTime, setPrepTime] = useState('');
  const [unlimitedTime, setUnlimitedTime] = useState(false);
  const [checkoutSession, setCheckoutSession] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [selectedSeatId, setSelectedSeatId] = useState(null);
  const [hourlyRate, setHourlyRate] = useState(loadHourlyRate);
  const [rateEditing, setRateEditing] = useState(false);
  const [rateInputValue, setRateInputValue] = useState(loadHourlyRate().toString());
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  const [splitSession, setSplitSession] = useState(null);
  const [viewMode, setViewMode] = useState('table'); // 'table' 或 'seat'
  const [draggedSessionId, setDraggedSessionId] = useState(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_SESSIONS_KEY, JSON.stringify(sessions));
    } catch (error) {
      console.error('Save sessions error:', error);
    }
  }, [sessions]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_RATE_KEY, hourlyRate.toString());
    } catch (error) {
      console.error('Save hourly rate error:', error);
    }
  }, [hourlyRate]);

  useEffect(() => {
    const timerId = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timerId);
  }, []);

  const parseGroupMembers = (input) =>
    input
      .split(',')
      .map((tail) => tail.trim().replace(/\D/g, ''))
      .filter((tail) => tail.length > 0)
      .reduce((acc, tail) => {
        if (!acc.includes(tail)) acc.push(tail);
        return acc;
      }, []);

  const saveHourlyRate = () => {
    const value = parseFloat(rateInputValue);
    if (isNaN(value) || value <= 0) {
      setAlertMessage('费率必须为大于 0 的数字');
      return;
    }
    setHourlyRate(value);
    setRateEditing(false);
  };

  const getElapsedSeconds = (startTime) => Math.floor((now - startTime) / 1000);

  const calculateCost = (elapsedSeconds) => {
    const billableSeconds = Math.max(0, elapsedSeconds);
    const elapsedMinutes = Math.ceil(billableSeconds / 60);
    return (elapsedMinutes * (hourlyRate / 60)).toFixed(2);
  };

  const formatTime = (totalSeconds) => {
    const sign = totalSeconds < 0 ? '-' : '';
    const absSec = Math.abs(totalSeconds);
    const h = Math.floor(absSec / 3600).toString().padStart(2, '0');
    const m = Math.floor((absSec % 3600) / 60).toString().padStart(2, '0');
    const s = (absSec % 60).toString().padStart(2, '0');
    return `${sign}${h}:${m}:${s}`;
  };

  const handleStart = (e) => {
    e.preventDefault();
    const mainSeatNumber = seatNumber.trim();
    const name = customerName.trim();
    const contact = contactPhone.trim();
    const party = parseInt(partySize, 10) || 1;

    if (!mainSeatNumber) {
      setAlertMessage('请输入座位号');
      return;
    }

    if (party <= 0) {
      setAlertMessage('人数必须大于 0');
      return;
    }

    if (sessions.some((session) => session.seatNumber === mainSeatNumber)) {
      setAlertMessage('该座位号已在使用中，请输入其他座位号');
      return;
    }

    const extraTails = parseGroupMembers(groupTails).filter((tail) => tail !== mainSeatNumber);
    const groupMembers = [mainSeatNumber, ...extraTails];

    const prepTimeMinutes = prepTime ? parseInt(prepTime, 10) : 0;
    const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const newSession = {
      id: sessionId,
      seatNumber: mainSeatNumber,
      customerName: name,
      contactPhone: contact,
      partySize: party,
      groupMembers,
      startTime: Date.now() + prepTimeMinutes * 60 * 1000,
      targetDuration: unlimitedTime ? null : duration ? parseInt(duration, 10) : null,
      isUnlimited: unlimitedTime,
      prepTimeMinutes,
      note: '',
    };

    setSessions((prev) => [...prev, newSession].sort((a, b) => a.startTime - b.startTime));
    setSeatNumber('');
    setCustomerName('');
    setContactPhone('');
    setPartySize('1');
    setGroupTails('');
    setDuration('');
    setPrepTime('');
    setUnlimitedTime(false);
  };

  const handleCheckoutClick = (session) => setCheckoutSession(session);

  const confirmCheckout = () => {
    if (!checkoutSession) return;
    setSessions((prev) => prev.filter((session) => session.id !== checkoutSession.id));
    setCheckoutSession(null);
  };

  const handleEditNote = (session) => {
    if (!session) {
      setEditingNoteId(null);
      setEditingNoteText('');
      return;
    }
    setEditingNoteId(session.id);
    setEditingNoteText(session.note || '');
  };

  const saveNote = (sessionId) => {
    setSessions((prev) =>
      prev.map((session) => (session.id === sessionId ? { ...session, note: editingNoteText } : session))
    );
    setEditingNoteId(null);
    setEditingNoteText('');
  };

  const handleSplitCheckout = (session, member) => {
    const members = session.groupMembers || [];
    if (members.length <= 1) return;
    const remainingMembers = members.filter((tail) => tail !== member);
    const splitSession = {
      ...session,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      seatNumber: member,
      groupMembers: [member],
      note: session.note || '',
    };

    setSessions((prev) =>
      prev
        .map((item) =>
          item.id === session.id
            ? {
                ...item,
                groupMembers: remainingMembers,
                seatNumber: remainingMembers[0] || item.seatNumber,
              }
            : item
        )
        .concat(splitSession)
        .sort((a, b) => a.startTime - b.startTime)
    );
    setSplitSession(null);
  };

  const handleSeatSelect = (seat) => {
    setSelectedSeatId(seat.id);
  };

  const handleDeleteSession = (sessionId) => {
    setSessions((prev) => prev.filter((session) => session.id !== sessionId));
  };

  const filteredSessions = sessions.filter((session) => {
    const members = session.groupMembers || [];
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) return true;

    return (
      members.some((member) => member.includes(normalizedQuery)) ||
      session.seatNumber.includes(normalizedQuery) ||
      session.customerName.toLowerCase().includes(normalizedQuery) ||
      session.contactPhone.includes(normalizedQuery)
    );
  });

  return (
    <div className="min-h-screen bg-amber-50 text-stone-800 font-sans">
      <header className="bg-amber-600 text-white shadow-md">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <Coffee className="w-8 h-8 text-amber-100" />
            <h1 className="text-2xl font-bold tracking-wide">鹈鹕镇拼豆桌游店</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-2 bg-amber-700/50 px-3 py-1.5 rounded-full">
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  viewMode === 'table'
                    ? 'bg-amber-500 text-white'
                    : 'text-amber-100 hover:bg-amber-700/30'
                }`}
              >
                表格视图
              </button>
              <button
                onClick={() => setViewMode('seat')}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors flex items-center gap-1 ${
                  viewMode === 'seat'
                    ? 'bg-amber-500 text-white'
                    : 'text-amber-100 hover:bg-amber-700/30'
                }`}
              >
                <Grid className="w-4 h-4" />
                座位视图
              </button>
            </div>
            <button
              onClick={() => {
                setRateEditing(true);
                setRateInputValue(hourlyRate.toString());
              }}
              className="flex items-center space-x-2 text-amber-100 bg-amber-700/50 hover:bg-amber-700/70 px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
            >
              <DollarSign className="w-4 h-4" />
              <span>费率：{hourlyRate.toFixed(2)}元 / 小时</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        <section className="bg-white rounded-2xl shadow-sm border border-amber-100 p-6">
          <h2 className="text-lg font-bold text-amber-900 mb-4 flex items-center">
            <Play className="w-5 h-5 mr-2" />
            新客开台
          </h2>
          <form onSubmit={handleStart} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="w-full">
                <label className="block text-sm font-medium text-stone-600 mb-1">
                  客人姓名
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="例如: 小王"
                  className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all text-lg font-medium placeholder:font-normal"
                />
              </div>

              <div className="w-full">
                <label className="block text-sm font-medium text-stone-600 mb-1">
                  客人姓名
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="例如: 小王"
                  className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all text-lg font-medium placeholder:font-normal"
                  required
                />
              </div>

              <div className="w-full">
                <label className="block text-sm font-medium text-stone-600 mb-1">
                  联系电话
                </label>
                <input
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="例如: 138xxxx1234"
                  className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all text-lg font-medium placeholder:font-normal"
                />
              </div>

              <div className="w-full">
                <label className="block text-sm font-medium text-stone-600 mb-1">
                  人数
                </label>
                <input
                  type="number"
                  min="1"
                  value={partySize}
                  onChange={(e) => setPartySize(e.target.value)}
                  placeholder="例如: 2"
                  className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all text-lg font-medium placeholder:font-normal"
                />
              </div>

              <div className="w-full">
                <label className="block text-sm font-medium text-stone-600 mb-1">
                  准备时间 (选填)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    value={prepTime}
                    onChange={(e) => setPrepTime(e.target.value)}
                    placeholder="例如: 5"
                    className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all text-lg font-medium placeholder:font-normal pr-12"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 font-medium">
                    分钟
                  </span>
                </div>
              </div>

              <div className="w-full">
                <label className="block text-sm font-medium text-stone-600 mb-1">
                  预设倒计时 (选填)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    placeholder="例如: 60"
                    disabled={unlimitedTime}
                    className={`w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all text-lg font-medium placeholder:font-normal pr-12 ${unlimitedTime ? 'opacity-60 cursor-not-allowed' : ''}`}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 font-medium">
                    分钟
                  </span>
                </div>
              </div>

              <div className="w-full flex items-center gap-2 px-4 py-3 rounded-xl bg-stone-50 border border-stone-200">
                <label className="inline-flex items-center gap-2 cursor-pointer text-sm text-stone-700">
                  <input
                    type="checkbox"
                    checked={unlimitedTime}
                    onChange={(e) => {
                      setUnlimitedTime(e.target.checked);
                      if (e.target.checked) {
                        setDuration('');
                      }
                    }}
                    className="w-4 h-4 text-amber-600 rounded border-stone-300 focus:ring-amber-500"
                  />
                  <span>不限时，不计时</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!seatNumber}
                className="px-8 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-stone-300 disabled:cursor-not-allowed text-white rounded-xl font-bold text-lg shadow-sm hover:shadow transition-all flex items-center justify-center h-[46px]"
              >
                <Timer className="w-5 h-5 mr-2" />
                开始计时
              </button>
            </div>
          </form>
        </section>

        <section>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-4">
            <h2 className="text-lg font-bold text-amber-900 flex items-center">
              <History className="w-5 h-5 mr-2" />
              当前计费中 ({sessions.length})
            </h2>
            <div className="relative">
              <input
                type="text"
                placeholder="搜索姓名 / 手机尾号 / 电话"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-64 pl-10 pr-4 py-2 bg-white border border-amber-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all text-sm"
              />
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {/* 座位视图 */}
          {viewMode === 'seat' && (
            <div className="mt-8 grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-6">
              <SeatMap
                sessions={sessions}
                onSelectSeat={handleSeatSelect}
                selectedSeatId={selectedSeatId}
                now={now}
                hourlyRate={hourlyRate}
              />
              <div className="space-y-4">
                <div className="bg-white rounded-2xl shadow-sm border border-amber-100 p-6">
                  <h3 className="text-lg font-bold text-amber-900 mb-4">拖拽订单</h3>
                  {filteredSessions.length === 0 ? (
                    <div className="text-center py-12 text-stone-400">
                      <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>暂无账单，请先开台</p>
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      {filteredSessions.map((session) => (
                        <button
                          key={session.id}
                          type="button"
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.effectAllowed = 'move';
                            e.dataTransfer.setData('text/plain', session.id);
                          }}
                          className="w-full text-left rounded-3xl border border-stone-200 p-3 flex items-center justify-between gap-3 hover:border-amber-300 transition-colors bg-stone-50"
                        >
                          <div>
                            <div className="text-sm font-semibold text-stone-900">{session.customerName || session.seatNumber}</div>
                            <div className="text-xs text-stone-500">座位号 {session.seatNumber} · {session.partySize}人</div>
                          </div>
                          <span className="text-xs text-stone-500">拖拽</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="bg-white rounded-2xl shadow-sm border border-amber-100 p-6">
                  <h3 className="text-lg font-bold text-amber-900 mb-4">使用提示</h3>
                  <p className="text-sm text-stone-500 leading-6">
                    编辑模式下可拖动座位。正常模式下将订单从右侧拖入空闲座位即可绑定。
                  </p>
                  <p className="text-sm text-stone-500 leading-6 mt-3">
                    点击座位可查看悬浮详情，拖拽到已占用座位则会自动移桌。
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 表格视图 */}
          {viewMode === 'table' && (
            <>
              {sessions.length === 0 ? (
                <div className="bg-white rounded-2xl border border-dashed border-stone-300 p-12 text-center text-stone-400">
                  <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-lg">暂无计费中的客人</p>
                  <p className="text-sm mt-1">在上方输入手机尾号开始计费</p>
                </div>
              ) : filteredSessions.length === 0 ? (
                <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center text-stone-400">
                  <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-lg">未找到该尾号的订单</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredSessions.map((session) => (
                    <DraggableSessionCard
                      key={session.id}
                      session={session}
                      now={now}
                      hourlyRate={hourlyRate}
                      onEditNote={handleEditNote}
                      onSaveNote={saveNote}
                      onDeleteSession={handleDeleteSession}
                      onSplitCheckout={setSplitSession}
                      onCheckout={handleCheckoutClick}
                      editingNoteId={editingNoteId}
                      editingNoteText={editingNoteText}
                      setEditingNoteText={setEditingNoteText}
                      onDragStart={(sessionId, e) => setDraggedSessionId(sessionId)}
                      isEditMode={false}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      </main>

      {rateEditing && (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-amber-500 p-6 text-center relative">
              <button
                onClick={() => setRateEditing(false)}
                className="absolute right-4 top-4 text-amber-100 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
              <h3 className="text-2xl font-bold text-white">编辑费率</h3>
              <p className="text-amber-100 mt-2">当前费率为 {hourlyRate.toFixed(2)} 元/小时</p>
            </div>
            <div className="p-6 space-y-4">
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={rateInputValue}
                onChange={(e) => setRateInputValue(e.target.value)}
                className="w-full px-4 py-3 border border-stone-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-lg"
                placeholder="输入新的每小时费率"
              />
            </div>
            <div className="p-4 bg-stone-50 grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  setRateEditing(false);
                  setRateInputValue(hourlyRate.toString());
                }}
                className="py-3 px-4 bg-stone-300 hover:bg-stone-400 text-white rounded-xl font-bold transition-colors"
              >
                取消
              </button>
              <button
                onClick={saveHourlyRate}
                className="py-3 px-4 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 transition-colors"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {splitSession && (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-blue-500 p-6 text-center relative">
              <button
                onClick={() => setSplitSession(null)}
                className="absolute right-4 top-4 text-blue-100 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
              <h3 className="text-2xl font-bold text-white">拆分付款</h3>
              <p className="text-blue-100 mt-2">请选择先单独结账的客人</p>
            </div>
            <div className="p-6 space-y-3">
              {(splitSession.groupMembers || []).map((member) => (
                <button
                  key={member}
                  onClick={() => handleSplitCheckout(splitSession, member)}
                  className="w-full text-left py-3 px-4 bg-blue-50 border border-blue-200 rounded-xl font-medium text-blue-900 hover:bg-blue-100 transition-colors"
                >
                  {member}
                </button>
              ))}
            </div>
            <div className="p-4 bg-stone-50 border-t border-stone-200">
              <button
                onClick={() => setSplitSession(null)}
                className="w-full py-3 bg-stone-300 hover:bg-stone-400 text-white rounded-xl font-bold transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {checkoutSession && (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-amber-500 p-6 text-center relative">
              <button
                onClick={() => setCheckoutSession(null)}
                className="absolute right-4 top-4 text-amber-100 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm">
                <DollarSign className="w-8 h-8 text-amber-500" />
              </div>
              <h3 className="text-2xl font-bold text-white">确认结账</h3>
              <p className="text-amber-100 mt-1 font-medium">座位号 {checkoutSession.seatNumber} 的客人</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-center border-b border-stone-100 pb-3">
                <span className="text-stone-500">开始时间</span>
                <span className="font-medium text-stone-800">
                  {new Date(checkoutSession.startTime - (checkoutSession.prepTimeMinutes || 0) * 60 * 1000).toLocaleTimeString()}
                </span>
              </div>
              <div className="flex justify-between items-center border-b border-stone-100 pb-3">
                <span className="text-stone-500">计费时长</span>
                <span className="font-medium text-stone-800">
                  {Math.ceil(Math.max(0, getElapsedSeconds(checkoutSession.startTime)) / 60)} 分钟
                </span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-stone-600 font-bold">总计应付</span>
                <span className="text-3xl font-bold text-amber-600">
                  ¥ {calculateCost(getElapsedSeconds(checkoutSession.startTime))}
                </span>
              </div>
            </div>
            <div className="p-4 bg-stone-50 grid grid-cols-2 gap-3">
              <button
                onClick={() => setCheckoutSession(null)}
                className="py-3 px-4 bg-white border border-stone-200 text-stone-600 rounded-xl font-bold hover:bg-stone-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={confirmCheckout}
                className="py-3 px-4 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 shadow-sm hover:shadow transition-all"
              >
                确认收款
              </button>
            </div>
          </div>
        </div>
      )}

      {alertMessage && (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 text-center animate-in fade-in zoom-in-95 duration-200">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
            <h3 className="text-xl font-bold text-stone-800 mb-2">提示</h3>
            <p className="text-stone-600 mb-6">{alertMessage}</p>
            <button
              onClick={() => setAlertMessage('')}
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold transition-colors"
            >
              我知道了
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
