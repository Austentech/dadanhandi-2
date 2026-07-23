"use client";

import { useState, useEffect, useRef } from "react";
import { POPUP_QUESTIONS, SITE_CONFIG } from "@/constants/content";

export default function HungerPopup() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentQ, setCurrentQ] = useState(0);
  const [progressActive, setProgressActive] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const qTimer1Ref = useRef<ReturnType<typeof setTimeout> | null>(null);
  const qTimer2Ref = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const shown = sessionStorage.getItem("popupShown");
    if (shown) return;

    const startTimer = setTimeout(() => {
      sessionStorage.setItem("popupShown", "1");
      setIsOpen(true);
      setProgressActive(true);

      qTimer1Ref.current = setTimeout(() => {
        if (currentQ < POPUP_QUESTIONS.length - 1) setCurrentQ(1);
      }, 5500);

      qTimer2Ref.current = setTimeout(() => {
        if (currentQ < POPUP_QUESTIONS.length - 1) setCurrentQ(2);
      }, 11000);
    }, 5000);

    timerRef.current = startTimer;

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (qTimer1Ref.current) clearTimeout(qTimer1Ref.current);
      if (qTimer2Ref.current) clearTimeout(qTimer2Ref.current);
    };
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    setProgressActive(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (qTimer1Ref.current) clearTimeout(qTimer1Ref.current);
    if (qTimer2Ref.current) clearTimeout(qTimer2Ref.current);
  };

  const goToQ = (idx: number) => {
    setCurrentQ(idx);
  };

  const question = POPUP_QUESTIONS[currentQ];

  return (
    <div className={`hunger-popup-overlay${isOpen ? " open" : ""}`}>
      <div className="hunger-popup-content">
        <div className={`popup-progress-bar${progressActive ? " animating" : ""}`} />

        <div className="popup-header">
          <span className="popup-title">🍲 {SITE_CONFIG.name}</span>
          <button className="popup-close-btn" onClick={handleClose} aria-label="Close">
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="popup-body">
          {POPUP_QUESTIONS.map((q, idx) => (
            <div key={idx} className={`popup-question${idx === currentQ ? " active" : ""}`}>
              <div className="popup-emoji">{q.emoji}</div>
              <div className="popup-question-text">{q.questionText}</div>
              <div className="popup-sub-text">{q.subText}</div>
              <div className="popup-btn-wrap">
                {q.buttons.map((btn, bIdx) => (
                  <a
                    key={bIdx}
                    href={btn.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`popup-btn-${btn.variant}`}
                  >
                    {btn.label}
                  </a>
                ))}
              </div>
            </div>
          ))}

          <div className="popup-dots">
            {POPUP_QUESTIONS.map((_, idx) => (
              <div
                key={idx}
                className={`popup-dot${idx === currentQ ? " active" : ""}`}
                onClick={() => goToQ(idx)}
              />
            ))}
          </div>
        </div>

        <div className="popup-footer">
          <span className="popup-skip-text" onClick={handleClose}>
            ✕ &nbsp;बाद में देखूँगा (Skip)
          </span>
        </div>
      </div>
    </div>
  );
}
