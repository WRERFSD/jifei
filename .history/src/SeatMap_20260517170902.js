import React, { useState, useEffect, useRef } from 'react';
import { Trash2, Plus, Grid } from 'lucide-react';

const STORAGE_SEATS_KEY = 'jifei_seats_layout';

const loadSeatsLayout = () => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_SEATS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.error('Load seats layout error:', error);
    return [];
  }
};

export default function SeatMap({ sessions, onSelectSeat, selectedSeatId, now, hourlyRate, onClearSelection }) {
  const containerRef = useRef(null);
  const [seats, setSeats] = useState(loadSeatsLayout);
  const [editMode, setEditMode] = useState(false);
  const [gridSize, setGridSize] = useState(8);
  const [draggingSeatId, setDraggingSeatId] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [defaultSeatSize, setDefaultSeatSize] = useState(60);
  const [layoutExportCode, setLayoutExportCode] = useState('');
  const [layoutImportText, setLayoutImportText] = useState('');
  const [layoutMessage, setLayoutMessage] = useState('');

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_SEATS_KEY, JSON.stringify(seats));
    } catch (error) {
      console.error('Save seats layout error:', error);
    }
  }, [seats]);

  useEffect(() => {
    setSeats((prev) =>
      prev.map((seat) =>
        seat.sessionId && !sessions.some((s) => s.id === seat.sessionId)
          ? { ...seat, sessionId: null }
          : seat
      )
    );
  }, [sessions]);

  const getContainerBounds = () => {
    const rect = containerRef.current?.getBoundingClientRect();
    return {
      width: containerRef.current?.clientWidth || 0,
      height: containerRef.current?.clientHeight || 0,
      left: rect?.left || 0,
      top: rect?.top || 0,
    };
  };

  const clampToBounds = (x, y, size) => {
    const bounds = getContainerBounds();
    const maxX = Math.max(0, bounds.width - size);
    const maxY = Math.max(0, bounds.height - size);
    return {
      x: Math.min(Math.max(0, x), maxX),
      y: Math.min(Math.max(0, y), maxY),
    };
  };

  const addSeat = () => {
    const newSeat = {
      id: `seat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      x: 50,
      y: 50,
      name: `座位${seats.length + 1}`,
      size: defaultSeatSize,
    };
    setSeats((prev) => [...prev, newSeat]);
  };

  const updateSeatSize = (seatId, size) => {
    const normalizedSize = Math.max(30, Math.min(140, Number(size) || 60));
    setSeats((prev) => prev.map((seat) => (seat.id === seatId ? { ...seat, size: normalizedSize } : seat)));
  };

  const deleteSeat = (seatId) => {
    setSeats((prev) => prev.filter((seat) => seat.id !== seatId));
  };

  const updateSeatName = (seatId, name) => {
    setSeats((prev) => prev.map((seat) => (seat.id === seatId ? { ...seat, name } : seat)));
  };

  const getSessionForSeat = (seatId) => {
    const seat = seats.find((s) => s.id === seatId);
    if (!seat || !seat.sessionId) return null;
    return sessions.find((s) => s.id === seat.sessionId);
  };

  const bindSessionToSeat = (seatId, sessionId) => {
    setSeats((prev) =>
      prev.map((seat) => {
        if (seat.sessionId === sessionId) {
          return { ...seat, sessionId: null };
        }
        if (seat.id === seatId) {
          return { ...seat, sessionId };
        }
        return seat;
      })
    );
  };

  const unbindSessionFromSeat = (seatId) => {
    setSeats((prev) => prev.map((seat) => (seat.id === seatId ? { ...seat, sessionId: null } : seat)));
  };

  const updateSeatPosition = (seatId, x, y) => {
    const alignedX = Math.round(x / gridSize) * gridSize;
    const alignedY = Math.round(y / gridSize) * gridSize;
    setSeats((prev) =>
      prev.map((seat) =>
        seat.id === seatId
          ? {
              ...seat,
              ...clampToBounds(alignedX, alignedY, seat.size),
            }
          : seat
      )
    );
  };

  const exportSeatLayout = () => {
    const payload = seats.map(({ id, x, y, name, size }) => ({ id, x, y, name, size }));
    const code = JSON.stringify(payload, null, 2);
    setLayoutExportCode(code);
    setLayoutMessage('已生成布局代码，可复制到其他设备。');
    return code;
  };

  const copyLayoutCode = async () => {
    const code = exportSeatLayout();
    try {
      await navigator.clipboard.writeText(code);
      setLayoutMessage('已复制布局代码到剪贴板。');
    } catch (error) {
      setLayoutMessage('复制失败，请手动选中并复制。');
    }
  };

  const importSeatLayout = () => {
    try {
      const parsed = JSON.parse(layoutImportText);
      if (!Array.isArray(parsed)) {
        throw new Error('必须是数组');
      }
      const validated = parsed.map((item, index) => {
        if (!item || typeof item !== 'object') throw new Error(`第 ${index + 1} 项无效`);
        const id = String(item.id || `seat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
        const x = Number(item.x);
        const y = Number(item.y);
        const size = Number(item.size) || 60;
        const name = String(item.name || `座位${index + 1}`);
        if (Number.isNaN(x) || Number.isNaN(y)) throw new Error(`第 ${index + 1} 项位置无效`);
        return { id, x, y, size, name, sessionId: null };
      });
      setSeats(validated);
      setLayoutImportText('');
      setLayoutExportCode(JSON.stringify(validated, null, 2));
      setLayoutMessage('已成功导入座位布局。');
    } catch (error) {
      setLayoutMessage(`导入失败：${error.message}`);
    }
  };

  const startSeatDrag = (seat, event) => {
    if (!editMode) return;
    const bounds = getContainerBounds();
    const pointerX = event.clientX - bounds.left;
    const pointerY = event.clientY - bounds.top;
    setDraggingSeatId(seat.id);
    setDragOffset({ x: pointerX - seat.x, y: pointerY - seat.y });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  useEffect(() => {
    if (!draggingSeatId) return;

    const onMove = (event) => {
      if (!draggingSeatId) return;
      const bounds = getContainerBounds();
      const pointerX = event.clientX - bounds.left;
      const pointerY = event.clientY - bounds.top;
      updateSeatPosition(draggingSeatId, pointerX - dragOffset.x, pointerY - dragOffset.y);
    };

    const onUp = () => setDraggingSeatId(null);

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);

    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [draggingSeatId, dragOffset]);

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

  const selectedSeat = selectedSeatId ? seats.find((seat) => seat.id === selectedSeatId) : null;
  const selectedSession = selectedSeat?.sessionId ? sessions.find((s) => s.id === selectedSeat.sessionId) : null;
  const popupLeft = selectedSeat ? Math.min(selectedSeat.x + selectedSeat.size + 12, 420) : 0;
  const popupTop = selectedSeat ? Math.max(selectedSeat.y, 20) : 0;

  const handleContainerClick = (event) => {
    if (event.target.closest('.seat-item') || event.target.closest('.seat-popup')) return;
    onClearSelection?.();
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-amber-100 p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold text-amber-900 flex items-center">
          <Grid className="w-5 h-5 mr-2" />
          座位布局管理
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => setEditMode(!editMode)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              editMode
                ? 'bg-blue-500 text-white hover:bg-blue-600'
                : 'bg-stone-200 text-stone-700 hover:bg-stone-300'
            }`}
          >
            {editMode ? '完成编辑' : '编辑布局'}
          </button>
          {editMode && (
            <button
              onClick={addSeat}
              className="px-4 py-2 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              添加座位
            </button>
          )}
        </div>
      </div>

      <div
        className="relative bg-amber-50 border-2 border-dashed border-amber-200 rounded-xl overflow-auto"
        style={{ height: '500px' }}
        ref={containerRef}
        onClick={handleContainerClick}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 800 880"
          preserveAspectRatio="xMidYMid slice"
          className="absolute inset-0 w-full h-full pointer-events-none"
        >
          <rect width="800" height="880" fill="#1e222b" />

          <defs>
            <pattern id="floor-tiles" width="60" height="60" patternUnits="userSpaceOnUse">
              <rect width="60" height="60" fill="#e3e1dc" stroke="#d0ceca" strokeWidth="1" />
            </pattern>

            <pattern id="terrazzo" width="50" height="50" patternUnits="userSpaceOnUse">
              <rect width="50" height="50" fill="#e2e7ec" />
              <circle cx="5" cy="8" r="2" fill="#cc5a37" />
              <circle cx="15" cy="25" r="1.5" fill="#3a5f78" />
              <circle cx="28" cy="12" r="2" fill="#6b7280" />
              <circle cx="34" cy="32" r="1" fill="#cc5a37" />
              <circle cx="10" cy="35" r="2" fill="#9ca3af" />
              <circle cx="42" cy="18" r="1.5" fill="#3a5f78" />
              <circle cx="22" cy="45" r="2.5" fill="#6b7280" />
            </pattern>
          </defs>

          <path d="M30,290 H110 V40 H760 V760 H440 V560 H200 V760 H30 Z" fill="#f2efe9" />

          <rect x="110" y="40" width="300" height="250" fill="url(#floor-tiles)" />

          <rect x="200" y="560" width="200" height="200" fill="url(#terrazzo)" />

          <rect x="32" y="292" width="376" height="140" fill="#ab947e" />

          <rect x="412" y="42" width="336" height="130" fill="#ab947e" />

          <rect x="498" y="248" width="174" height="254" fill="#ab947e" />

          <g transform="translate(300, 710)">
            <rect x="-22" y="10" width="44" height="16" rx="4" fill="#ffffff" stroke="#b0b5b8" strokeWidth="2" />
            <ellipse cx="0" cy="-12" rx="15" ry="20" fill="#ffffff" stroke="#b0b5b8" strokeWidth="2" />
            <ellipse cx="0" cy="-10" rx="11" ry="15" fill="#f7f9fa" stroke="#d1d5d8" strokeWidth="1" />
          </g>

          <path d="M202,610 A40,40 0 0,1 242,570" fill="none" stroke="#b0b5b8" strokeWidth="3" />
          <line x1="202" y1="570" x2="202" y2="610" stroke="#b0b5b8" strokeWidth="2" />
          <line x1="202" y1="570" x2="242" y2="570" stroke="#b0b5b8" strokeWidth="2" />

          <rect x="22" y="290" width="16" height="470" fill="#9c9c9c" stroke="#555555" strokeWidth="1.5" />
          <rect x="30" y="282" width="80" height="16" fill="#9c9c9c" stroke="#555555" strokeWidth="1.5" />
          <rect x="102" y="40" width="16" height="250" fill="#9c9c9c" stroke="#555555" strokeWidth="1.5" />

          <rect x="110" y="30" width="650" height="12" fill="#ffffff" stroke="#9c9c9c" strokeWidth="1" />
          <line x1="110" y1="36" x2="760" y2="36" stroke="#9c9c9c" strokeWidth="1" />

          <rect x="752" y="40" width="16" height="720" fill="#9c9c9c" stroke="#555555" strokeWidth="1.5" />

          <rect x="30" y="752" width="80" height="16" fill="#9c9c9c" stroke="#555555" strokeWidth="1.5" />
          <rect x="200" y="752" width="200" height="16" fill="#9c9c9c" stroke="#555555" strokeWidth="1.5" />
          <rect x="440" y="752" width="110" height="16" fill="#9c9c9c" stroke="#555555" strokeWidth="1.5" />
          <rect x="680" y="752" width="80" height="16" fill="#9c9c9c" stroke="#555555" strokeWidth="1.5" />

          <rect x="402" y="40" width="16" height="252" fill="#9c9c9c" stroke="#555555" strokeWidth="1.5" />

          <rect x="192" y="560" width="16" height="200" fill="#9c9c9c" stroke="#555555" strokeWidth="1.5" />
          <rect x="200" y="552" width="200" height="16" fill="#9c9c9c" stroke="#555555" strokeWidth="1.5" />
          <rect x="392" y="560" width="16" height="200" fill="#9c9c9c" stroke="#555555" strokeWidth="1.5" />

          <rect x="432" y="560" width="16" height="200" fill="#9c9c9c" stroke="#555555" strokeWidth="1.5" />

          <rect x="22" y="220" width="4" height="20" fill="#7a5c43" />
          <rect x="402" y="560" width="4" height="15" fill="#7a5c43" />
          <rect x="444" y="580" width="4" height="60" fill="#7a5c43" />
          <rect x="752" y="590" width="4" height="40" fill="#7a5c43" />

          <g transform="translate(200, 760)">
            <path d="M 0,0 L 0,80 A 80,80 0 0,1 -80,0 Z" fill="#92979b" opacity="0.6" />
            <line x1="0" y1="0" x2="0" y2="80" stroke="#ffffff" strokeWidth="2" />
          </g>

          <g transform="translate(550, 760)">
            <path d="M 0,0 L 0,65 A 65,65 0 0,1 65,0 Z" fill="#92979b" opacity="0.6" />
            <line x1="0" y1="0" x2="0" y2="65" stroke="#ffffff" strokeWidth="2" />
          </g>
          <g transform="translate(680, 760)">
            <path d="M 0,0 L 0,65 A 65,65 0 0,0 -65,0 Z" fill="#92979b" opacity="0.6" />
            <line x1="0" y1="0" x2="0" y2="65" stroke="#ffffff" strokeWidth="2" />
          </g>

          <g fill="#a6a6a6" stroke="#666666" strokeWidth="1.5">
            <circle cx="30" cy="760" r="10" />
            <circle cx="200" cy="760" r="10" />
            <circle cx="400" cy="760" r="10" />
            <circle cx="440" cy="760" r="10" />
            <circle cx="760" cy="760" r="10" />
            <circle cx="760" cy="40" r="10" />
            <circle cx="110" cy="40" r="10" />
            <circle cx="110" cy="290" r="10" />
            <circle cx="30" cy="290" r="10" />
          </g>
          <g fill="#555555">
            <circle cx="30" cy="760" r="2" />
            <circle cx="200" cy="760" r="2" />
            <circle cx="400" cy="760" r="2" />
            <circle cx="440" cy="760" r="2" />
            <circle cx="760" cy="760" r="2" />
            <circle cx="760" cy="40" r="2" />
            <circle cx="110" cy="40" r="2" />
            <circle cx="110" cy="290" r="2" />
            <circle cx="30" cy="290" r="2" />
          </g>

          <circle cx="440" cy="560" r="4" fill="#6ba4ff" stroke="#ffffff" strokeWidth="1" />
        </svg>

        {seats.map((seat) => {
          const session = getSessionForSeat(seat.id);
          const isSelected = selectedSeatId === seat.id;

          return (
            <div
              key={seat.id}
              className="absolute group seat-item"
              style={{
                left: `${seat.x}px`,
                top: `${seat.y}px`,
                cursor: editMode ? 'grab' : 'pointer',
              }}
              draggable={false}
              onPointerDown={(e) => startSeatDrag(seat, e)}
              onDragOver={(e) => {
                if (!editMode) e.preventDefault();
              }}
              onDrop={(e) => {
                if (editMode) return;
                e.preventDefault();
                const sessionId = e.dataTransfer.getData('text/plain');
                if (sessionId) {
                  bindSessionToSeat(seat.id, sessionId);
                }
              }}
              onClick={() => !editMode && onSelectSeat(seat)}
            >
              <div
                className={`rounded-lg shadow-md transition-all flex items-center justify-center font-bold text-white cursor-pointer ${
                  session
                    ? 'bg-green-500 hover:bg-green-600'
                    : isSelected
                    ? 'bg-blue-500 hover:bg-blue-600'
                    : 'bg-stone-400 hover:bg-stone-500'
                } ${editMode ? 'ring-2 ring-yellow-400' : ''}`}
                style={{
                  width: `${seat.size}px`,
                  height: `${seat.size}px`,
                }}
              >
                {session ? (
                  session.customerName ? (
                    <span className="text-[11px] text-center px-1 leading-tight">
                      {session.customerName}
                      <br />
                      <span className="text-[10px] text-white/80">{session.seatNumber}</span>
                    </span>
                  ) : (
                    <span className="text-[11px] text-center px-1 leading-tight">
                      {session.seatNumber}
                    </span>
                  )
                ) : (
                  <span className="text-xs text-center px-1">{seat.name}</span>
                )}
              </div>

              {editMode && (
                <div className="absolute top-0 right-0 transform translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => deleteSeat(seat.id)}
                    className="bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow-md"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {selectedSeat && (
          <div
            className="absolute z-20 max-w-xs rounded-3xl bg-white border border-stone-200 shadow-2xl p-4 text-sm text-stone-700 seat-popup"
            style={{ left: `${popupLeft}px`, top: `${popupTop}px`, width: '260px' }}
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-xs text-stone-500">座位详情</div>
                <div className="font-semibold text-stone-900">{selectedSeat.name}</div>
              </div>
              <div className="text-xs font-semibold text-amber-700">{selectedSession ? '已占用' : '空闲'}</div>
            </div>
            {selectedSession ? (
              <div className="space-y-2">
                <div className="text-xs text-stone-500">客人</div>
                <div className="font-medium text-stone-900">{selectedSession.customerName || '未填写姓名'}</div>
                <div className="text-xs text-stone-500">座位号 {selectedSession.seatNumber}</div>
                <div className="flex justify-between text-xs text-stone-500">
                  <span>电话</span>
                  <span>{selectedSession.contactPhone}</span>
                </div>
                <div className="flex justify-between text-xs text-stone-500">
                  <span>人数</span>
                  <span>{selectedSession.partySize}人</span>
                </div>
                <div className="flex justify-between text-xs text-stone-500">
                  <span>计费方式</span>
                  <span>{selectedSession.isUnlimited ? '不限时' : '计时'}</span>
                </div>
                {!selectedSession.isUnlimited ? (
                  <>
                    <div className="flex justify-between text-xs text-stone-500">
                      <span>已用时</span>
                      <span>{formatTime(getElapsedSeconds(selectedSession.startTime))}</span>
                    </div>
                    <div className="flex justify-between text-xs text-stone-500">
                      <span>费用</span>
                      <span className="font-bold text-amber-600">¥{calculateCost(getElapsedSeconds(selectedSession.startTime))}</span>
                    </div>
                  </>
                ) : (
                  <div className="rounded-2xl bg-amber-50 p-3 text-xs font-medium text-amber-700 border border-amber-100">
                    该订单为不限时，不计时收费
                  </div>
                )}
                {selectedSession.note && (
                  <div className="rounded-2xl bg-stone-50 p-3 border border-stone-200 text-xs text-stone-700">
                    {selectedSession.note}
                  </div>
                )}
                <button
                  onClick={() => unbindSessionFromSeat(selectedSeat.id)}
                  className="w-full rounded-2xl bg-red-500 hover:bg-red-600 text-white py-2 font-semibold"
                >
                  解绑座位
                </button>
              </div>
            ) : (
              <div className="text-sm text-stone-500">该座位当前空闲，可将订单拖拽到此处绑定。</div>
            )}
          </div>
        )}
      </div>

      <div className="mt-6 rounded-3xl bg-stone-50 border border-stone-200 p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-stone-900">座位布局同步</h3>
            <p className="text-sm text-stone-500">导出当前布局代码，或者粘贴布局代码到其他设备。</p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <label className="flex items-center gap-2 text-sm text-stone-700 bg-white px-3 py-2 rounded-2xl border border-stone-200">
              <span>默认座位尺寸</span>
              <input
                type="number"
                min="30"
                max="140"
                value={defaultSeatSize}
                onChange={(e) => setDefaultSeatSize(Number(e.target.value) || 60)}
                className="w-20 px-2 py-1 text-sm border border-stone-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span>px</span>
            </label>
            <button
              type="button"
              onClick={exportSeatLayout}
              className="px-4 py-2 bg-amber-500 text-white rounded-xl hover:bg-amber-600 transition-colors text-sm"
            >
              生成布局代码
            </button>
            <button
              type="button"
              onClick={copyLayoutCode}
              className="px-4 py-2 bg-stone-900 text-white rounded-xl hover:bg-stone-800 transition-colors text-sm"
            >
              复制到剪贴板
            </button>
          </div>
        </div>
        <textarea
          rows={6}
          value={layoutExportCode}
          readOnly
          placeholder="点击“生成布局代码”后，这里会显示导出的 JSON 布局。"
          className="w-full rounded-2xl border border-stone-200 bg-white p-3 text-xs font-mono text-stone-700 resize-none"
        />
        <div className="space-y-2">
          <label className="text-sm font-medium text-stone-700">导入布局代码</label>
          <textarea
            rows={4}
            value={layoutImportText}
            onChange={(e) => setLayoutImportText(e.target.value)}
            placeholder='直接粘贴另一个设备导出的布局 JSON，例如: [{"id":"seat-1","x":50,"y":50,"name":"A1","size":60}]'
            className="w-full rounded-2xl border border-stone-200 bg-white p-3 text-xs font-mono text-stone-700 resize-none"
          />
          <button
            type="button"
            onClick={importSeatLayout}
            className="px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors text-sm"
          >
            导入布局
          </button>
        </div>
        {layoutMessage && <div className="text-sm text-stone-600">{layoutMessage}</div>}
      </div>

      {editMode && (
        <div className="mt-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {seats.map((seat) => (
            <div key={seat.id} className="p-3 bg-stone-50 border border-stone-200 rounded-lg">
              <input
                type="text"
                value={seat.name}
                onChange={(e) => updateSeatName(seat.id, e.target.value)}
                className="w-full px-2 py-1 text-sm border border-stone-200 rounded mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="座位名称"
              />
              <div className="flex items-center gap-2 mb-2">
                <label className="text-xs text-stone-500">尺寸</label>
                <input
                  type="number"
                  min="30"
                  max="140"
                  value={seat.size}
                  onChange={(e) => updateSeatSize(seat.id, e.target.value)}
                  className="w-20 px-2 py-1 text-sm border border-stone-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-xs text-stone-500">px</span>
              </div>
              <div className="text-xs text-stone-500 mb-2">位置: ({seat.x}, {seat.y})</div>
              <button
                onClick={() => deleteSeat(seat.id)}
                className="w-full px-2 py-1 bg-red-500 hover:bg-red-600 text-white text-sm rounded transition-colors"
              >
                删除
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 text-sm text-stone-500">
        共{seats.length}个座位 | 已绑定{seats.filter((s) => s.sessionId).length}个账单
      </div>
    </div>
  );
}
