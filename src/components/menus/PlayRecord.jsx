import { useState, useEffect } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { loadAllRecords } from '../../logic/saveEngine'

export default function PlayRecord() {
  const playerId = useGameStore(s => s.playerId)
  const setCurrentScreen = useGameStore(s => s.setCurrentScreen)
  const [records, setRecords] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(Boolean(playerId))

  useEffect(() => {
    if (!playerId) return undefined

    let ignore = false
    loadAllRecords(playerId).then(data => {
      if (ignore) return
      setRecords(data)
      setLoading(false)
    })

    return () => {
      ignore = true
    }
  }, [playerId])

  const gradeColors = { S: '#FFD700', A: '#00FF41', B: '#00AA00', C: '#DC143C' }

  if (selected) {
    return (
      <div className="cr2-record-screen cr2-scrollable">
        <div className="cr2-record-header">
          <button className="cr2-btn" onClick={() => setSelected(null)}>← 뒤로</button>
          <div className="cr2-record-detail-title">
            {selected.result_type === 'CLEAR' ? '✅ 클리어 기록' : '💀 파산 기록'}
          </div>
        </div>

        <div className="cr2-record-detail">
          <div className="cr2-record-detail-stats">
            {selected.clear_grade && (
              <div className="cr2-record-grade" style={{ color: gradeColors[selected.clear_grade] }}>
                {selected.clear_grade} 등급
              </div>
            )}
            <div className="cr2-stat-row"><span>도달 층수</span><span>{selected.clear_floor}층</span></div>
            <div className="cr2-stat-row"><span>최종 자본</span><span>{(selected.final_capital / 10000).toFixed(0)}만원</span></div>
            <div className="cr2-stat-row"><span>어드바이저</span><span>{getAdvisorName(selected.advisor_id)}</span></div>
            <div className="cr2-stat-row"><span>플레이타임</span><span>{formatTime(selected.playtime)}</span></div>
            <div className="cr2-stat-row"><span>흑자 턴</span><span className="cr2-positive">{selected.profit_turns}턴</span></div>
            <div className="cr2-stat-row"><span>적자 턴</span><span className="cr2-negative">{selected.loss_turns}턴</span></div>
            <div className="cr2-stat-row"><span>최고 점유율</span><span>{((selected.max_share || 0) * 100).toFixed(1)}%</span></div>
            <div className="cr2-stat-row"><span>파산 위기</span><span>{selected.bankruptcy_count}회</span></div>
            <div className="cr2-stat-row">
              <span>이벤트 성공률</span>
              <span>{Math.round((selected.event_success_rate || 0) * 100)}%</span>
            </div>
            <div className="cr2-stat-row"><span>날짜</span><span>{new Date(selected.created_at).toLocaleDateString('ko-KR')}</span></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="cr2-record-screen cr2-scrollable">
      <div className="cr2-record-header">
        <button className="cr2-btn" onClick={() => setCurrentScreen('title')}>← 뒤로</button>
        <div className="cr2-record-title">플레이 기록</div>
      </div>

      {loading && <div className="cr2-loading">불러오는 중...</div>}

      {!loading && records.length === 0 && (
        <div className="cr2-record-empty">아직 기록이 없습니다.</div>
      )}

      <div className="cr2-record-list">
        {records.map(record => (
          <div
            key={record.id || `${record.created_at}-${record.clear_floor}`}
            className={`cr2-record-item ${record.result_type === 'CLEAR' ? 'cr2-record-clear' : 'cr2-record-bankrupt'}`}
            onClick={() => setSelected(record)}
          >
            <div className="cr2-record-item-header">
              {record.result_type === 'CLEAR' ? (
                <span style={{ color: gradeColors[record.clear_grade] }}>
                  ✅ {record.clear_grade}등급 클리어
                </span>
              ) : (
                <span className="cr2-negative">💀 파산</span>
              )}
            </div>
            <div className="cr2-record-item-info">
              <span>{getAdvisorName(record.advisor_id)}</span>
              <span>·</span>
              <span>Floor {record.clear_floor}</span>
              <span>·</span>
              <span>{(record.final_capital / 10000).toFixed(0)}만원</span>
            </div>
            <div className="cr2-record-item-date cr2-gray">
              {new Date(record.created_at).toLocaleDateString('ko-KR')}
              &nbsp;{formatTime(record.playtime)}
            </div>
          </div>
        ))}

        {Array.from({ length: Math.max(0, 5 - records.length) }).map((_, i) => (
          <div key={`empty-${i}`} className="cr2-record-item cr2-record-empty-slot">
            <div className="cr2-gray">기록 없음</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function getAdvisorName(id) {
  const map = { raider: 'The Raider', guardian: 'The Guardian', analyst: 'The Analyst', gambler: 'The Gambler' }
  return map[id] || id
}

function formatTime(seconds) {
  if (!seconds) return '00:00'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
