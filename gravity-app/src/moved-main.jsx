import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ArrowRight, ArrowUpFromSquare} from '@gravity-ui/icons';
import {Button, Icon, ThemeProvider} from '@gravity-ui/uikit';
import mascotHappy from './assets/mascot/happy.png';
import '@gravity-ui/uikit/styles/styles.css';
import './theme.css';
import './moved.css';

const REPORT_URL =
  'https://navigator.sigma.sbrf.ru/gdash/1000006647#eyJmdWxsc2NyZWVuV2lkZ2V0SUQiOjEwMDA1NDQ2MjB9';

function isMobileDevice() {
  if (navigator.userAgentData?.mobile !== undefined) {
    return navigator.userAgentData.mobile;
  }

  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

async function copyReportUrl() {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(REPORT_URL);
    return;
  }

  const input = document.createElement('textarea');
  input.value = REPORT_URL;
  input.setAttribute('readonly', '');
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.appendChild(input);
  input.select();

  const copied = document.execCommand('copy');
  input.remove();

  if (!copied) {
    throw new Error('Copy command was rejected');
  }
}

function MovedPage() {
  const [status, setStatus] = useState('');

  const handleShare = async () => {
    setStatus('');

    if (isMobileDevice() && navigator.share) {
      try {
        await navigator.share({
          title: 'Data Driven в Навигаторе',
          text: 'Полный отчёт Data Driven теперь доступен в Навигаторе.',
          url: REPORT_URL,
        });
      } catch (error) {
        if (error?.name !== 'AbortError') {
          setStatus('Не получилось открыть меню «Поделиться»');
        }
      }
      return;
    }

    try {
      await copyReportUrl();
      setStatus('Ссылка скопирована');
    } catch {
      setStatus('Не удалось скопировать ссылку');
    }
  };

  return (
    <main className="moved-page">
      <section className="moved-card" aria-labelledby="moved-title">
        <img
          className="moved-mascot"
          src={mascotHappy}
          alt="Радостный котик Data Driven"
        />

        <div className="moved-copy">
          <h1 id="moved-title">
            <span>Привет!</span>
            <span>Мы переехали</span>
          </h1>
          <p>
            Полный отчёт доступен в{' '}
            <a href={REPORT_URL} target="_blank" rel="noreferrer">
              Навигаторе (Sigma)
            </a>{' '}
            по ссылке.
          </p>
        </div>

        <div className="moved-actions">
          <Button
            className="moved-button"
            view="action"
            size="xl"
            onClick={() => window.location.assign(REPORT_URL)}
          >
            Перейти
            <Icon data={ArrowRight} size={18} />
          </Button>
          <Button
            className="moved-button"
            view="outlined"
            size="xl"
            onClick={handleShare}
          >
            <Icon data={ArrowUpFromSquare} size={18} />
            Отправить ссылку
          </Button>
        </div>

        <div className="moved-status" role="status" aria-live="polite">
          {status}
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(
  <ThemeProvider theme="light">
    <MovedPage />
  </ThemeProvider>,
);
