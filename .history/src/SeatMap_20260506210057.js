import React, { useState, useEffect } from 'react';
import { Trash2, Plus, Grid3X3 } from 'lucide-react';

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

export default function SeatMap({ sessions, onSelectSeat, selectedSeatId }) {
  const [seats, setSeats] = useState(loadSeatsLayout);
  const [editMode, setEditMode] = useState(false);
  const [gridSize, setGridSize] = useState(8); // 网格大小，用于对齐

  // 保存座位布局到localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_SEATS_KEY, JSON.stringify(seats));
    } catch (error) {
      console.error('Save seats layout error:', error);
    }
  }, [seats]);

  // 添加新座位
  const addSeat = () => {
    const newSeat = {
      id: `seat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      x: 50,
      y: 50,
      name: `座位${seats.length + 1}`,
      size: 60, // 座位大小（像素）
    };
    setSeats((prev) => [...prev, newSeat]);
  };

  // 删除座位
  const deleteSeat = (seatId) => {
    setSeats((prev) => prev.filter((seat) => seat.id !== seatId));
  };

  // 更新座位位置
  const updateSeatPosition = (seatId, x, y) => {
    // 对齐到网格
    const alignedX = Math.round(x / gridSize) * gridSize;
    const alignedY = Math.round(y / gridSize) * gridSize;
    
    setSeats((prev) =>
      prev.map((seat) =>
        seat.id === seatId ? { ...seat, x: alignedX, y: alignedY } : seat
      )
    );
  };

  // 更新座位名称
  const updateSeatName = (seatId, name) => {
    setSeats((prev) =>
      prev.map((seat) => (seat.id === seatId ? { ...seat, name } : seat))
    );
  };

  // 获取座位对应的账单信息
  const getSessionForSeat = (seatId) => {
    // 座位ID和会话绑定通过sessionId存储在座位上
    const seat = seats.find((s) => s.id === seatId);
    if (!seat || !seat.sessionId) return null;
    return sessions.find((s) => s.id === seat.sessionId);
  };

  // 绑定账单到座位
  const bindSessionToSeat = (seatId, sessionId) => {
    setSeats((prev) =>
      prev.map((seat) =>
        seat.id === seatId ? { ...seat, sessionId } : seat
      )
    );
  };

  // 解绑座位上的账单
  const unbindSessionFromSeat = (seatId) => {
    setSeats((prev) =>
      prev.map((seat) =>
        seat.id === seatId ? { ...seat, sessionId: null } : seat
      )
    );
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-amber-100 p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold text-amber-900 flex items-center">
          <Grid3X3 className="w-5 h-5 mr-2" />
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

      {/* 座位布局画布 */}
      <div className="relative bg-amber-50 border-2 border-dashed border-amber-200 rounded-xl overflow-auto" style={{ height: '500px' }}>
        <svg
          className="absolute inset-0 w-full h-full"
          style={{
            backgroundImage: editMode ? `linear-gradient(rgba(0,0,0,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.05) 1px, transparent 1px)` : 'none',
            backgroundSize: editMode ? `${gridSize}px ${gridSize}px` : 'auto',
          }}
        >
          {/* 这里用于绘制座位之间的连线等 */}
        </svg>

        {/* 座位元素 */}
        {seats.map((seat) => {
          const session = getSessionForSeat(seat.id);
          const isSelected = selectedSeatId === seat.id;

          return (
            <div
              key={seat.id}
              className="absolute group"
              style={{
                left: `${seat.x}px`,
                top: `${seat.y}px`,
                cursor: editMode ? 'grab' : 'pointer',
              }}
              draggable={editMode}
              onDragEnd={(e) => {
                const rect = e.currentTarget.parentElement.getBoundingClientRect();
                const newX = e.clientX - rect.left;
                const newY = e.clientY - rect.top;
                updateSeatPosition(seat.id, newX, newY);
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
                  <span className="text-xs text-center px-1 leading-tight">
                    {session.phoneTail}
                  </span>
                ) : (
                  <span className="text-xs text-center px-1">{seat.name}</span>
                )}
              </div>

              {/* 编辑模式下的控制 */}
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
      </div>

      {/* 座位列表和编辑 */}
      {editMode && (
        <div className="mt-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {seats.map((seat) => (
            <div
              key={seat.id}
              className="p-3 bg-stone-50 border border-stone-200 rounded-lg"
            >
              <input
                type="text"
                value={seat.name}
                onChange={(e) => updateSeatName(seat.id, e.target.value)}
                className="w-full px-2 py-1 text-sm border border-stone-200 rounded mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="座位名称"
              />
              <div className="text-xs text-stone-500 mb-2">
                位置: ({seat.x}, {seat.y})
              </div>
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
