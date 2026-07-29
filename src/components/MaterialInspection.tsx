import { useState } from 'react'

const INSPECTION_URL = 'https://www.scetia.com/Scetia.OnlineExplorer/App_Public/Login.aspx?ReturnUrl=%2fScetia.OnlineExplorer%2fMyAccount%2fChangeUserInfo.aspx'
const REGISTRATION_URL = 'https://ciac.zjw.sh.gov.cn/JGBCiacUserPortalInterXCRYWeb/pc/#/login?args=02'

function openExternal(url: string) {
  const w = window.open(url, '_blank', 'noopener,noreferrer')
  if (!w) {
    // 弹窗被拦截，使用当前窗口跳转
    window.location.href = url
  }
}

export default function MaterialInspection() {
  const [url] = useState(INSPECTION_URL)
  const [regUrl] = useState(REGISTRATION_URL)

  return (
    <>
      <div className="page-header">
        <h2>材料检测</h2>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={() => openExternal(regUrl)}>
            📋 建材使用登记
          </button>
          <button className="btn btn-primary" onClick={() => openExternal(url)}>
            🧪 检测样品登记
          </button>
        </div>
      </div>

      <div className="page-content">
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <h3>快捷入口</h3>
          </div>
          <div className="card-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            {/* 建材使用登记 */}
            <div style={{ textAlign: 'center', padding: '20px 0', borderRight: '1px solid var(--border)' }}>
              <div style={{
                width: 72, height: 72, borderRadius: 18,
                background: 'linear-gradient(135deg, #34c759, #30b350)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px', fontSize: 32,
              }}>
                📋
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>建材使用登记</h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                点击下方按钮跳转至建材使用登记网站
              </p>
              <button
                className="btn btn-primary"
                onClick={() => openExternal(regUrl)}
                style={{ fontSize: 14, padding: '8px 24px' }}
              >
                前往登记网站
              </button>
            </div>

            {/* 材料检测 */}
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{
                width: 72, height: 72, borderRadius: 18,
                background: 'linear-gradient(135deg, #007AFF, #5856D6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px', fontSize: 32,
              }}>
                🧪
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>材料检测平台</h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                点击下方按钮跳转至材料检测网站
              </p>
              <button
                className="btn btn-primary"
                onClick={() => openExternal(url)}
                style={{ fontSize: 14, padding: '8px 24px' }}
              >
                前往检测网站
              </button>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>材料检测说明</h3>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'var(--primary-bg)', color: 'var(--primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: 16, flexShrink: 0,
                }}>1</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>准备样品</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    按照规范要求准备检测材料样品，确保样品具有代表性
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'var(--primary-bg)', color: 'var(--primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: 16, flexShrink: 0,
                }}>2</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>填写委托单</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    在检测平台填写材料检测委托单，注明检测项目和标准
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'var(--primary-bg)', color: 'var(--primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: 16, flexShrink: 0,
                }}>3</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>检测登记</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    将样品送至检测机构并完成登记手续
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'var(--primary-bg)', color: 'var(--primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: 16, flexShrink: 0,
                }}>4</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>查询结果</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    在检测平台查询检测进度和检测报告
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
