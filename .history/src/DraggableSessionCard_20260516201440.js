import React, { useState } from 'react';
import { Clock, DollarSign, X, Edit2, Save, Trash2 } from 'lucide-react';

export default function DraggableSessionCard({
  session,
  now,
  hourlyRate,
  onEditNote,
  onSaveNote,
  onDeleteSession,
  onSplitCheckout,
  onCheckout,
  editingNoteId,
  editingNoteText,
  setEditingNoteText,
  onDragStart,
  isEditMode = false,
}) {
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

  const elapsedSecs = getElapsedSeconds(session.startTime);
  const isUnlimited = session.isUnlimited;
  const cost = isUnlimited ? null : calculateCost(elapsedSecs);
  let remainingSecs = null;
  let isOvertime = false;

  if (!isUnlimited && session.targetDuration) {
    remainingSecs = session.targetDuration * 60 - elapsedSecs;
    isOvertime = remainingSecs < 0;
  }

  return (
    <div
      draggable={!editingNoteId && !isEditMode}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', session.id);
        onDragStart?.(session.id, e);
      }}
      className={`bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden flex flex-col hover:border-amber-300 transition-colors ${
        !editingNoteId && !isEditMode ? 'cursor-grab active:cursor-grabbing' : ''
      }`}
    >
      {/* 卡片顶部 */}
      <div className="bg-stone-50 px-5 py-3 border-b border-stone-100 flex justify-between items-center">
        <span className="font-bold text-lg text-stone-800 flex flex-col gap-1">
          <span className="flex items-center gap-2">
            <span>座位号：</span>
            <span className="text-amber-600 text-xl">{session.seatNumber}</span>
            {(session.groupMembers?.length || 0) > 1 && (
              <span className="text-xs font-medium bg-blue-100 text-blue-700 px-2 py-1 rounded">
                {session.groupMembers.length}人
              </span>
            )}
          </span>
          {session.customerName && (
            <span className="text-xs text-stone-500">{session.customerName}</span>
          )}
        </span>
        <span className="text-xs font-medium text-stone-400 bg-stone-200/50 px-2 py-1 rounded">
          {new Date(session.startTime - (session.prepTimeMinutes || 0) * 60 * 1000).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}{' '}
          开台
        </span>
      </div>

      {/* 卡片内容 */}
      <div className="p-5 flex-1 space-y-4">
        {/* 时间显示 */}
        <div className="space-y-2">
          {isUnlimited ? (
            <div className="flex justify-between items-end">
              <span className="text-sm font-medium text-stone-500">不限时</span>
              <span className="text-3xl font-mono font-bold tracking-tight text-amber-600">
                不计时
              </span>
            </div>
          ) : session.targetDuration ? (
            <div className="flex justify-between items-end">
              <span className="text-sm font-medium text-stone-500">倒计时</span>
              <span
                className={`text-3xl font-mono font-bold tracking-tight ${
                  isOvertime ? 'text-red-500' : 'text-stone-800'
                }`}
              >
                {isOvertime ? '+' : ''}{formatTime(Math.abs(remainingSecs))}
              </span>
            </div>
          ) : (
            <div className="flex justify-between items-end">
              <span className="text-sm font-medium text-stone-500">已用时</span>
              <span className="text-3xl font-mono font-bold tracking-tight text-amber-600">
                {formatTime(elapsedSecs)}
              </span>
            </div>
          )}

          {session.targetDuration && (
            <div className="flex justify-between text-xs font-medium text-stone-400 border-t border-stone-100 pt-2 mt-2">
              <span>计费时长: {Math.ceil(Math.max(0, elapsedSecs) / 60)} 分钟</span>
              <span>预设: {session.targetDuration} 分钟</span>
            </div>
          )}
        </div>

        {/* 费用显示 */}
        <div className="bg-amber-50 rounded-xl p-3 flex justify-between items-center">
          <span className="text-sm font-medium text-amber-800 flex items-center">
            <DollarSign className="w-4 h-4 mr-1" />
            实时费用
          </span>
          <span className={`text-2xl font-bold ${isUnlimited ? 'text-stone-400' : 'text-amber-600'}`}>
            {isUnlimited ? '不限时' : <><span className="text-lg mr-1">¥</span>{cost}</>}
          </span>
        </div>

        {/* 备注编辑 */}
        {editingNoteId === session.id ? (
          <div className="space-y-2">
            <textarea
              value={editingNoteText}
              onChange={(e) => setEditingNoteText(e.target.value)}
              placeholder="输入备注..."
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white resize-none text-sm"
              rows="3"
            />
            <div className="flex gap-2">
              <button
                onClick={() => onSaveNote(session.id)}
                className="flex-1 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium text-sm transition-colors"
              >
                保存
              </button>
              <button
                onClick={() => onEditNote(null)}
                className="flex-1 py-2 bg-stone-300 hover:bg-stone-400 text-white rounded-xl font-medium text-sm transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        ) : (
          <div
            onClick={() => onEditNote(session)}
            className="p-3 bg-stone-50 border border-stone-200 rounded-lg cursor-pointer hover:bg-stone-100 transition-colors text-sm"
          >
            {session.note ? (
              <>
                <p className="font-medium text-stone-600 mb-1">备注：</p>
                <p className="text-stone-700 whitespace-pre-wrap">{session.note}</p>
              </>
            ) : (
              <p className="text-stone-400 italic">点击添加备注...</p>
            )}
          </div>
        )}
      </div>

      {/* 卡片底部操作按钮 */}
      <div className="p-4 pt-0 space-y-2">
        {(session.groupMembers?.length || 0) > 1 && (
          <button
            onClick={() => onSplitCheckout(session)}
            className="w-full py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold text-sm transition-colors flex items-center justify-center"
          >
            拆分付款
          </button>
        )}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onCheckout(session)}
            className="py-3 bg-stone-800 hover:bg-stone-900 text-white rounded-xl font-bold text-sm flex items-center justify-center transition-colors"
          >
            结账
          </button>
          <button
            onClick={() => onDeleteSession(session.id)}
            className="py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold text-sm flex items-center justify-center transition-colors"
          >
            删除
          </button>
        </div>
      </div>
    </div>
  );
}
