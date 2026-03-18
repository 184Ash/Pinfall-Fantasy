// src/LandingPage.jsx
import { useEffect } from "react";
import logoImg from "../public/pinfall-fantasy-logo.png";
import { useNavigate } from "react-router-dom";

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow:wght@300;400;500;600&family=Barlow+Condensed:wght@400;600;700&display=swap');

  .lp-body { background-color: #1E2128; color: #E8E4DC; font-family: 'Barlow', sans-serif; font-weight: 300; overflow-x: hidden; -webkit-font-smoothing: antialiased; margin: 0; padding: 0; }
  .lp-nav { position: fixed; top: 0; left: 0; right: 0; z-index: 100; padding: 20px 48px; display: flex; align-items: center; justify-content: space-between; background: linear-gradient(to bottom, rgba(30,33,40,0.98) 0%, rgba(30,33,40,0) 100%); }
  .lp-nav-logo-wrap { display: flex; align-items: center; gap: 12px; text-decoration: none; }
  .lp-nav-logo-img { width: 36px; height: 36px; }
  .lp-nav-logo { font-family: 'Bebas Neue', sans-serif; font-size: 22px; letter-spacing: 0.12em; color: #C9A84C; text-decoration: none; }
  .lp-nav-beta { font-family: 'Barlow Condensed', sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 0.2em; text-transform: uppercase; color: #1E2128; background: #C9A84C; padding: 4px 10px; border-radius: 2px; }
  .lp-hero { position: relative; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 120px 24px 80px; overflow: hidden; background-color: #1E2128; }
  .lp-hero::after { content: ''; position: absolute; top: 40%; left: 50%; transform: translate(-50%, -50%); width: 900px; height: 700px; background: radial-gradient(ellipse, rgba(201,168,76,0.12) 0%, rgba(201,168,76,0.04) 40%, transparent 70%); pointer-events: none; }
  .lp-mat-ring { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 680px; height: 680px; border-radius: 50%; border: 1px solid rgba(201,168,76,0.08); pointer-events: none; }
  .lp-mat-ring::before { content: ''; position: absolute; inset: 40px; border-radius: 50%; border: 1px solid rgba(201,168,76,0.05); }
  .lp-mat-ring::after { content: ''; position: absolute; inset: 120px; border-radius: 50%; border: 1px solid rgba(201,168,76,0.04); }
  .lp-hero-lines { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
  .lp-hero-lines::before { content: ''; position: absolute; top: -200px; left: -200px; width: 200%; height: 200%; background: repeating-linear-gradient(-45deg, transparent, transparent 80px, rgba(201,168,76,0.018) 80px, rgba(201,168,76,0.018) 81px); }
  .lp-hero-logo-wrap { position: relative; z-index: 2; margin-bottom: 32px; opacity: 0; animation: lpFadeUp 0.7s ease 0.1s forwards; }
  .lp-hero-eyebrow { position: relative; z-index: 2; font-family: 'Barlow Condensed', sans-serif; font-size: 16px; font-weight: 600; letter-spacing: 0.35em; text-transform: uppercase; color: #C9A84C; margin-bottom: 24px; display: flex; align-items: center; gap: 14px; opacity: 0; animation: lpFadeUp 0.7s ease 0.2s forwards; }
  .lp-hero-eyebrow::before, .lp-hero-eyebrow::after { content: ''; display: block; width: 32px; height: 1px; background: #8C6E2A; }
  .lp-hero-title { position: relative; z-index: 2; font-family: 'Bebas Neue', sans-serif; font-size: clamp(72px, 11vw, 148px); line-height: 0.92; letter-spacing: 0.03em; color: #C9A84C; opacity: 0; animation: lpFadeUp 0.8s ease 0.35s forwards; }
  .lp-hero-title .lp-word-draft { display: block; color: #E8E4DC; }
  .lp-hero-subtitle { position: relative; z-index: 2; margin-top: 28px; font-size: 19px; font-weight: 400; line-height: 1.75; color: #B8C0C8; max-width: 480px; opacity: 0; animation: lpFadeUp 0.8s ease 0.5s forwards; }
  .lp-hero-subtitle strong { color: #E8E4DC; font-weight: 500; }
  .lp-hero-cta-group { position: relative; z-index: 2; margin-top: 52px; display: flex; flex-direction: column; align-items: center; gap: 16px; opacity: 0; animation: lpFadeUp 0.8s ease 0.65s forwards; }
  .lp-btn-create { display: inline-flex; align-items: center; gap: 12px; background: #C9A84C; color: #1E2128; font-family: 'Barlow Condensed', sans-serif; font-size: 17px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; text-decoration: none; padding: 18px 44px; border: none; cursor: pointer; transition: background 0.2s, transform 0.15s; clip-path: polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px)); }
  .lp-btn-create:hover { background: #E2C06A; transform: translateY(-2px); }
  .lp-btn-learn { font-family: 'Barlow Condensed', sans-serif; font-size: 13px; font-weight: 600; letter-spacing: 0.2em; text-transform: uppercase; color: #9EA8B0; text-decoration: none; border-bottom: 1px solid transparent; padding-bottom: 2px; transition: color 0.2s, border-color 0.2s; }
  .lp-btn-learn:hover { color: #E8E4DC; border-color: #8C6E2A; }
  .lp-hero-note { font-size: 13px; letter-spacing: 0.12em; color: #B89A3A; font-family: 'Barlow Condensed', sans-serif; font-weight: 600; }
  .lp-stats-bar { position: relative; z-index: 2; margin-top: 80px; display: flex; align-items: center; border-top: 1px solid rgba(201,168,76,0.15); border-bottom: 1px solid rgba(201,168,76,0.15); opacity: 0; animation: lpFadeUp 0.8s ease 0.8s forwards; }
  .lp-stat-item { padding: 20px 40px; text-align: center; border-right: 1px solid rgba(201,168,76,0.1); }
  .lp-stat-item:last-child { border-right: none; }
  .lp-stat-num { font-family: 'Bebas Neue', sans-serif; font-size: 36px; letter-spacing: 0.05em; color: #C9A84C; line-height: 1; }
  .lp-stat-label { font-family: 'Barlow Condensed', sans-serif; font-size: 10px; font-weight: 600; letter-spacing: 0.22em; text-transform: uppercase; color: #9EA8B0; margin-top: 4px; }
  .lp-marquee-section { background: #16191F; border-top: 1px solid rgba(201,168,76,0.12); border-bottom: 1px solid rgba(201,168,76,0.12); padding: 14px 0; overflow: hidden; white-space: nowrap; }
  .lp-marquee-track { display: inline-flex; animation: lpMarquee 28s linear infinite; }
  .lp-marquee-item { font-family: 'Barlow Condensed', sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 0.3em; text-transform: uppercase; color: #4A5260; padding: 0 28px; border-right: 1px solid rgba(201,168,76,0.15); }
  .lp-features { padding: 120px 48px; max-width: 1200px; margin: 0 auto; }
  .lp-section-label { font-family: 'Barlow Condensed', sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 0.3em; text-transform: uppercase; color: #C9A84C; margin-bottom: 16px; }
  .lp-section-heading { font-family: 'Bebas Neue', sans-serif; font-size: clamp(40px, 5vw, 64px); letter-spacing: 0.03em; color: #E8E4DC; line-height: 1; }
  .lp-section-sub { font-size: 17px; color: #9EA8B0; margin-top: 16px; max-width: 540px; line-height: 1.7; }
  .lp-features-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px; margin-top: 60px; }
  .lp-feature-card { background: #16191F; padding: 36px 32px; border: 1px solid rgba(255,255,255,0.04); transition: border-color 0.2s, background 0.2s; }
  .lp-feature-card:hover { border-color: rgba(201,168,76,0.2); background: #1A1D24; }
  .lp-feature-icon { font-size: 28px; display: block; margin-bottom: 18px; }
  .lp-feature-title { font-family: 'Barlow Condensed', sans-serif; font-size: 18px; font-weight: 700; letter-spacing: 0.06em; color: #E8E4DC; text-transform: uppercase; margin-bottom: 10px; }
  .lp-feature-desc { font-size: 15px; color: #6A7480; line-height: 1.7; }
  .lp-how { background: #16191F; padding: 120px 48px; }
  .lp-how-inner { max-width: 1100px; margin: 0 auto; }
  .lp-steps-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0; margin-top: 60px; position: relative; }
  .lp-steps-row::before { content: ''; position: absolute; top: 28px; left: 28px; right: 28px; height: 1px; background: linear-gradient(to right, transparent, rgba(201,168,76,0.3), transparent); }
  .lp-step { padding: 0 28px; }
  .lp-step-num { font-family: 'Bebas Neue', sans-serif; font-size: 48px; color: #C9A84C; line-height: 1; margin-bottom: 16px; position: relative; }
  .lp-step-num::after { content: ''; position: absolute; bottom: -8px; left: 0; width: 24px; height: 2px; background: #C9A84C; }
  .lp-step-title { font-family: 'Barlow Condensed', sans-serif; font-size: 18px; font-weight: 700; color: #E8E4DC; text-transform: uppercase; letter-spacing: 0.06em; margin-top: 24px; margin-bottom: 10px; }
  .lp-step-desc { font-size: 14px; color: #6A7480; line-height: 1.7; }
  .lp-bottom-cta { padding: 140px 48px; text-align: center; background: linear-gradient(to bottom, #1E2128 0%, #16191F 100%); }
  .lp-bottom-cta-title { font-family: 'Bebas Neue', sans-serif; font-size: clamp(60px, 9vw, 112px); letter-spacing: 0.03em; color: #E8E4DC; line-height: 0.9; margin-bottom: 24px; }
  .lp-bottom-cta-title span { color: #C9A84C; }
  .lp-bottom-cta-sub { font-size: 16px; color: #9EA8B0; margin-bottom: 48px; line-height: 1.6; }
  footer.lp-footer { padding: 32px 48px; background-color: #13151A; border-top: 1px solid rgba(255,255,255,0.05); }
  .lp-footer-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
  .lp-footer-logo-wrap { display: flex; align-items: center; gap: 10px; }
  .lp-footer-logo-img { width: 28px; height: 28px; opacity: 0.7; }
  .lp-footer-logo { font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 0.1em; color: #8C6E2A; }
  .lp-footer-note { font-family: 'Barlow Condensed', sans-serif; font-size: 12px; letter-spacing: 0.1em; color: #4A5260; }
  .lp-footer-disclaimer { font-family: 'Barlow Condensed', sans-serif; font-size: 11px; color: #3A4250; line-height: 1.6; border-top: 1px solid rgba(255,255,255,0.04); padding-top: 14px; max-width: 900px; }
  .lp-reveal { opacity: 0; transform: translateY(32px); transition: opacity 0.7s ease, transform 0.7s ease; }
  .lp-reveal.lp-visible { opacity: 1; transform: translateY(0); }
  @keyframes lpFadeUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes lpMarquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
  @media (max-width: 900px) {
    .lp-nav { padding: 18px 24px; }
    .lp-features { padding: 80px 24px; }
    .lp-features-grid { grid-template-columns: 1fr; }
    .lp-steps-row { grid-template-columns: repeat(2, 1fr); gap: 40px; }
    .lp-steps-row::before { display: none; }
    .lp-how { padding: 80px 24px; }
    .lp-stat-item { padding: 16px 20px; }
    .lp-bottom-cta { padding: 100px 24px; }
    footer.lp-footer { padding: 24px; }
    .lp-footer-top { flex-direction: column; gap: 10px; text-align: center; }
  }
  @media (max-width: 600px) {
    .lp-steps-row { grid-template-columns: 1fr; }
    .lp-stats-bar { flex-wrap: wrap; justify-content: center; }
    .lp-stat-item { border-right: none; border-bottom: 1px solid rgba(201,168,76,0.1); width: 50%; }
  }
`;

const marqueeItems = ["125 LB","133 LB","141 LB","149 LB","157 LB","165 LB","174 LB","184 LB","197 LB","285 LB","NCAA WRESTLING","FANTASY DRAFT","SNAKE DRAFT","LIVE SCORING"];

export default function LandingPage() {
  const navigate = useNavigate();
  useEffect(() => {
    const reveals = document.querySelectorAll('.lp-reveal');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('lp-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    reveals.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="lp-body">
      <style>{css}</style>

      <nav className="lp-nav">
        <a className="lp-nav-logo-wrap" href="#">
          <img className="lp-nav-logo-img" src={logoImg} alt="Pinfall Fantasy" />
          <span className="lp-nav-logo">Pinfall Fantasy</span>
        </a>
        <span className="lp-nav-beta">Beta</span>
      </nav>

      <section className="lp-hero">
        <div className="lp-hero-lines" />
        <div className="lp-mat-ring" />
        <div className="lp-hero-logo-wrap">
          <img src={logoImg} alt="Pinfall Fantasy" width="200" height="200" />
        </div>
        <p className="lp-hero-eyebrow">NCAA Wrestling Fantasy Draft</p>
        <h1 className="lp-hero-title">
          Pinfall<span className="lp-word-draft">Fantasy</span>
        </h1>
        <p className="lp-hero-subtitle">
          The fantasy draft platform built for <strong>real wrestling fans.</strong>{" "}
          Draft your roster, compete all tournament long, and settle the debate on who knows wrestling best.
        </p>
        <div className="lp-hero-cta-group">
          <a onClick={()=>navigate("/create")} className="lp-btn-create" style={{cursor:"pointer"}}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Create a League
          </a>
          <a href="#how" className="lp-btn-learn">How it works ↓</a>
          <p className="lp-hero-note">Free to use &nbsp;·&nbsp; No account required &nbsp;·&nbsp; Share a link to invite your league</p>
        </div>
        <div className="lp-stats-bar">
          <div className="lp-stat-item"><div className="lp-stat-num">10</div><div className="lp-stat-label">Weight Classes</div></div>
          <div className="lp-stat-item"><div className="lp-stat-num">330</div><div className="lp-stat-label">Wrestlers Seeded</div></div>
          <div className="lp-stat-item"><div className="lp-stat-num">30</div><div className="lp-stat-label">Teams Max</div></div>
          <div className="lp-stat-item"><div className="lp-stat-num">Live</div><div className="lp-stat-label">Draft Sync</div></div>
        </div>
      </section>

      <div className="lp-marquee-section">
        <div className="lp-marquee-track">
          {[...marqueeItems, ...marqueeItems].map((item, i) => (
            <span key={i} className="lp-marquee-item">{item}</span>
          ))}
        </div>
      </div>

      <section className="lp-features">
        <div className="lp-reveal">
          <p className="lp-section-label">What you get</p>
          <h2 className="lp-section-heading">Built for the mat.</h2>
          <p className="lp-section-sub">Everything you need for a serious NCAA wrestling fantasy draft — nothing you don't.</p>
        </div>
        <div className="lp-features-grid lp-reveal">
          {[
            { icon: "🏆", title: "Full Tournament Draft Board", desc: "All 10 weight classes, 330 seeded wrestlers, snake or linear rotation. The whole tournament in one board." },
            { icon: "⚡", title: "Live Draft Sync", desc: "Every pick appears instantly for everyone in your league. No refreshing, no calling out picks in a group chat." },
            { icon: "🙋", title: "Claim Your Team", desc: "Open the link, enter your name, and claim your spot. No accounts, no passcodes — just one link for the whole league." },
            { icon: "🔄", title: "Live Score Sync", desc: "One button pulls live results straight from FloArena. Standings update instantly for every team in your league — no manual entry, no spreadsheets." },
            { icon: "🛡", title: "Commissioner Controls", desc: "Full admin access to reassign picks, manage the waiting room, and run the draft from start to finish." },
            { icon: "💾", title: "Persistent State", desc: "Your draft lives in the cloud. Close the tab, reopen the link — everything is exactly where you left it." },
          ].map((f, i) => (
            <div key={i} className="lp-feature-card">
              <span className="lp-feature-icon">{f.icon}</span>
              <div className="lp-feature-title">{f.title}</div>
              <p className="lp-feature-desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-how" id="how">
        <div className="lp-how-inner">
          <div className="lp-reveal">
            <p className="lp-section-label">How it works</p>
            <h2 className="lp-section-heading">From zero to draft day in minutes.</h2>
            <p className="lp-section-sub">No downloads, no accounts, no technical setup required.</p>
          </div>
          <div className="lp-steps-row lp-reveal">
            {[
              { n: "1", title: "Create a League", desc: "Name your league, set your team count, choose your draft format and rotation type." },
              { n: "2", title: "Share the Link", desc: "You get a unique league URL. Send it to your group chat — that's it. No passcodes to hand out." },
              { n: "3", title: "Claim & Draft", desc: "Everyone opens the link, claims their team, and waits for the commissioner to start the draft." },
              { n: "4", title: "Watch & Score", desc: "Hit the Sync button between sessions and live results flow in automatically. Standings update for the whole league in seconds." },
            ].map((s, i) => (
              <div key={i} className="lp-step">
                <div className="lp-step-num">{s.n}</div>
                <div className="lp-step-title">{s.title}</div>
                <p className="lp-step-desc">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-bottom-cta">
        <div className="lp-reveal">
          <h2 className="lp-bottom-cta-title">Ready to<br /><span>Play?</span></h2>
          <p className="lp-bottom-cta-sub">
            Free to use. Free to host your league.<br />
            No account. Just a link.
          </p>
          <a onClick={()=>navigate("/create")} className="lp-btn-create" style={{cursor:"pointer"}}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Create a League
          </a>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="lp-footer-top">
          <div className="lp-footer-logo-wrap">
            <img className="lp-footer-logo-img" src={logoImg} alt="" />
            <div className="lp-footer-logo">Pinfall Fantasy</div>
          </div>
          <div className="lp-footer-note">© 2026 pinfallfantasy.com &nbsp;·&nbsp; Beta</div>
        </div>
        <div className="lp-footer-disclaimer">
          Pinfall Fantasy is an independent fan tool and is not affiliated with, endorsed by, or connected to the NCAA, its member institutions, TrackWrestling, FloWrestling, or any other organization. Athlete names and school affiliations are used for fantasy sports identification purposes only. No commercial use of athlete likenesses is intended or implied. This platform does not facilitate gambling or prize pools of any kind.
        </div>
      </footer>
    </div>
  );
}
