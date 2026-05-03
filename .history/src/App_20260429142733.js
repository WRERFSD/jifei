import React, { useState, useEffect } from 'react';
import { Clock, Play, Square, CheckSquare, Coffee, DollarSign, AlertCircle, Timer, X, History, Search } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';

// 修复预览环境偶发的 tailwind is not defined 错误
if (typeof window !== 'undefined') {
  window.tailwind = window.tailwind || { config: {} };
}

// 初始化 Firebase 云端数据库
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// 计费常量
const HOURLY_RATE = 9.9;
const MINUTE_RATE = HOURLY_RATE / 60;

export default function App() {
  const [sessions, setSessions] = useState([]);
  const [now, setNow] = useState(Date.now());
  const [phoneTail, setPhoneTail] = useState('');
  const [duration, setDuration] = useState(''); // 预设倒计时分钟数
  const [checkoutSession, setCheckoutSession] = useState(null); // 正在结账的会话
  const [searchQuery, setSearchQuery] = useState(''); // 搜索关键词
  const [alertMessage, setAlertMessage] = useState(''); // 自定义提示弹窗信息

  // 新增状态：当前用户和加载状态
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // 初始化认证
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error('Auth error:', error);
        setIsLoading(false);
      }
    };
    initAuth();

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) setIsLoading(false);
    });

    return () => unsubscribeAuth();
  }, []);

  // 监听云端数据库数据
  useEffect(() => {
    if (!user) return;
    setIsLoading(true);
    const sessionsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'sessions');
    
    const unsubscribeSnapshot = onSnapshot(sessionsRef, (snapshot) => {
      const fetchedSessions = [];
      snapshot.forEach((doc) => {
        fetchedSessions.push({ ...doc.data(), id: doc.id });
      });
      // 按开始时间排序
      fetchedSessions.sort((a, b) => a.startTime - b.startTime);
      setSessions(fetchedSessions);
      setIsLoading(false);
    }, (error) => {
      console.error("Firestore error:", error);
      setAlertMessage("数据同步失败，请刷新重试");
      setIsLoading(false);
    });

    return () => unsubscribeSnapshot();
  }, [user]);

  // 每秒更新当前时间，驱动所有计时器
  useEffect(() => {
    const timerId = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timerId);
  }, []);

  // 开始新计时
  const handleStart = async (e) => {
    e.preventDefault();
    
    if (!user) {
      setAlertMessage("系统尚未连接到云端，请稍候...");
      return;
    }

    if (!phoneTail || phoneTail.length < 2) {
      setAlertMessage("请输入有效的手机尾号（至少2位）");
      return;
    }

    // 检查是否重号
    if (sessions.some(s => s.phoneTail === phoneTail.trim())) {
      setAlertMessage("该手机尾号已在计费中，请勿重复开台！");
      return;
    }

    // 增加 5 分钟（300000毫秒）准备时间，将计费起点往后推5分钟
    const PREP_TIME_MS = 5 * 60 * 1000;
    const sessionId = Date.now().toString();

    const newSession = {
      id: sessionId,
      phoneTail: phoneTail.trim(),
      startTime: Date.now() + PREP_TIME_MS,
      targetDuration: duration ? parseInt(duration, 10) : null,
    };

    try {
      // 写入云端数据库
      const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'sessions', sessionId);
      await setDoc(docRef, newSession);
      
      setPhoneTail('');
      setDuration('');
    } catch (error) {
      console.error("Save error:", error);
      setAlertMessage("开台失败，未能保存到云端");
    }
  };

  // 点击结账按钮，打开确认弹窗
  const handleCheckoutClick = (session) => {
    setCheckoutSession(session);
  };

  // 确认结账并移除会话
  const confirmCheckout = async () => {
    if (!user || !checkoutSession) return;
    
    try {
      // 从云端数据库删除
      const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'sessions', checkoutSession.id);
      await deleteDoc(docRef);
      
      setCheckoutSession(null);
    } catch (error) {
      console.error("Delete error:", error);
      setAlertMessage("结账失败，未能从云端移除");
    }
  };

  // 计算已用时间（秒），允许为负数（代表准备时间）
  const getElapsedSeconds = (startTime) => {
    return Math.floor((now - startTime) / 1000);
  };

  // 计算实时费用（不足一分钟按一分钟算，准备时间内费用为0）
  const calculateCost = (elapsedSeconds) => {
    const billableSeconds = Math.max(0, elapsedSeconds);
    const elapsedMinutes = Math.ceil(billableSeconds / 60);
    return (elapsedMinutes * MINUTE_RATE).toFixed(2);
  };

  // 格式化时间戳为 HH:MM:SS
  const formatTime = (totalSeconds) => {
    const sign = totalSeconds < 0 ? "-" : "";
    const absSec = Math.abs(totalSeconds);
    const h = Math.floor(absSec / 3600).toString().padStart(2, '0');
    const m = Math.floor((absSec % 3600) / 60).toString().padStart(2, '0');
    const s = (absSec % 60).toString().padStart(2, '0');
    return `${sign}${h}:${m}:${s}`;
  };

  // 根据搜索关键词过滤会话
  const filteredSessions = sessions.filter(session => session.phoneTail.includes(searchQuery));

  return (
    <div className="min-h-screen bg-amber-50 text-stone-800 font-sans">
      {/* 顶部导航 */}
      <header className="bg-amber-600 text-white shadow-md">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Coffee className="w-8 h-8 text-amber-100" />
            <h1 className="text-2xl font-bold tracking-wide">鹈鹕镇拼豆桌游店</h1>
          </div>
          <div className="flex items-center space-x-2 text-amber-100 bg-amber-700/50 px-3 py-1.5 rounded-full text-sm font-medium">
            <DollarSign className="w-4 h-4" />
            <span>费率：9.9元 / 小时</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        
        {/* 控制面板（开台表单） */}
        <section className="bg-white rounded-2xl shadow-sm border border-amber-100 p-6">
          <h2 className="text-lg font-bold text-amber-900 mb-4 flex items-center">
            <Play className="w-5 h-5 mr-2" />
            新客开台
          </h2>
          <form onSubmit={handleStart} className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 w-full">
              <label className="block text-sm font-medium text-stone-600 mb-1">
                手机尾号 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                maxLength="4"
                value={phoneTail}
                onChange={(e) => setPhoneTail(e.target.value.replace(/\D/g, ''))}
                placeholder="例如: 8866"
                className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all text-lg font-medium placeholder:font-normal"
                required
              />
            </div>
            <div className="flex-1 w-full">
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
                  className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all text-lg font-medium placeholder:font-normal pr-12"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 font-medium">
                  分钟
                </span>
              </div>
            </div>
            <button
              type="submit"
              disabled={!phoneTail}
              className="w-full md:w-auto px-8 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-stone-300 disabled:cursor-not-allowed text-white rounded-xl font-bold text-lg shadow-sm hover:shadow transition-all flex items-center justify-center h-[46px]"
            >
              <Timer className="w-5 h-5 mr-2" />
              开始计时
            </button>
          </form>
        </section>

        {/* 活跃会话网格 */}
        <section>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-4">
            <h2 className="text-lg font-bold text-amber-900 flex items-center">
              <History className="w-5 h-5 mr-2" />
              当前计费中 ({sessions.length})
            </h2>
            <div className="relative">
              <input
                type="text"
                placeholder="搜索手机尾号..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value.replace(/\D/g, ''))}
                className="w-full sm:w-64 pl-10 pr-4 py-2 bg-white border border-amber-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all text-sm"
              />
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {sessions.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-stone-300 p-12 text-center text-stone-400">
              <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-lg">{isLoading ? "正在同步云端数据..." : "暂无计费中的客人"}</p>
              <p className="text-sm mt-1">{isLoading ? "请稍候" : "在上方输入手机尾号开始计费"}</p>
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center text-stone-400">
              <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-lg">未找到该尾号的订单</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredSessions.map((session) => {
                const elapsedSecs = getElapsedSeconds(session.startTime);
                const cost = calculateCost(elapsedSecs);
                let remainingSecs = null;
                let isOvertime = false;

                if (session.targetDuration) {
                  remainingSecs = session.targetDuration * 60 - elapsedSecs;
                  isOvertime = remainingSecs < 0;
                }

                return (
                  <div key={session.id} className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden flex flex-col hover:border-amber-300 transition-colors">
                    {/* 卡片头部 */}
                    <div className="bg-stone-50 px-5 py-3 border-b border-stone-100 flex justify-between items-center">
                      <span className="font-bold text-lg text-stone-800 flex items-center">
                        尾号：<span className="text-amber-600 text-xl ml-1">{session.phoneTail}</span>
                      </span>
                      <span className="text-xs font-medium text-stone-400 bg-stone-200/50 px-2 py-1 rounded">
                        {new Date(session.startTime - 5 * 60 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} 开台
                      </span>
                    </div>

                    {/* 卡片主体（时间与费用） */}
                    <div className="p-5 flex-1 space-y-4">
                      {/* 时间显示区 */}
                      <div className="space-y-2">
                        {session.targetDuration ? (
                          <div className="flex justify-between items-end">
                            <span className="text-sm font-medium text-stone-500">倒计时</span>
                            <span className={`text-3xl font-mono font-bold tracking-tight ${isOvertime ? 'text-red-500' : 'text-stone-800'}`}>
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
                        
                        {/* 辅助时间显示（如果开启了倒计时，辅助显示总用时） */}
                        {session.targetDuration && (
                           <div className="flex justify-between text-xs font-medium text-stone-400 border-t border-stone-100 pt-2 mt-2">
                             <span>计费时长: {Math.ceil(Math.max(0, elapsedSecs)/60)} 分钟</span>
                             <span>预设: {session.targetDuration} 分钟</span>
                           </div>
                        )}
                      </div>

                      {/* 费用显示区 */}
                      <div className="bg-amber-50 rounded-xl p-3 flex justify-between items-center">
                        <span className="text-sm font-medium text-amber-800 flex items-center">
                          <DollarSign className="w-4 h-4 mr-1" />
                          实时费用
                        </span>
                        <span className="text-2xl font-bold text-amber-600">
                          <span className="text-lg mr-1">¥</span>{cost}
                        </span>
                      </div>
                    </div>

                    {/* 结账按钮 */}
                    <div className="p-4 pt-0">
                      <button
                        onClick={() => handleCheckoutClick(session)}
                        className="w-full py-3 bg-stone-800 hover:bg-stone-900 text-white rounded-xl font-bold flex items-center justify-center transition-colors"
                      >
                        <CheckSquare className="w-5 h-5 mr-2" />
                        结账
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* 结账确认弹窗 */}
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
              <p className="text-amber-100 mt-1 font-medium">尾号 {checkoutSession.phoneTail} 的客人</p>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-center border-b border-stone-100 pb-3">
                <span className="text-stone-500">开始时间</span>
                <span className="font-medium text-stone-800">
                  {new Date(checkoutSession.startTime - 5 * 60 * 1000).toLocaleTimeString()}
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

      {/* 自定义警告弹窗 */}
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