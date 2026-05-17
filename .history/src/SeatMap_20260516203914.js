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
      size: 60,
    };
    setSeats((prev) => [...prev, newSeat]);
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
          className="absolute inset-0 w-full h-full"
          style={{
            backgroundImage: editMode
              ? `linear-gradient(rgba(0,0,0,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.05) 1px, transparent 1px)`
              : 'none',
            backgroundSize: editMode ? `${gridSize}px ${gridSize}px` : 'auto',
          }}
        />

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
                  <span className="text-[11px] text-center px-1 leading-tight">
                    {session.customerName || session.seatNumber}
                    <br />
                    <span className="text-[10px] text-white/80">{session.seatNumber}</span>
                  </span>
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
