import './App.css';
import { useState, useEffect } from 'react';

import removeBackground from '@imgly/background-removal';

function calculateSecondsBetweenDates(startDate, endDate) {
  const milliseconds = endDate - startDate;
  const seconds = (milliseconds / 1000.0).toFixed(1);
  return seconds;
}

function App() {
  const images = [
    'https://images.unsplash.com/photo-1686002359940-6a51b0d64f68?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1024&q=80',
    'https://images.unsplash.com/photo-1590523278191-995cbcda646b?ixlib=rb-1.2.1&q=80&fm=jpg&crop=entropy&cs=tinysrgb&w=1080&fit=max&ixid=eyJhcHBfaWQiOjEyMDd9'
  ];
  const randomImage = images[Math.floor(Math.random() * images.length)];
  const [imageUrl, setImageUrl] = useState(randomImage);
  const [isRunning, setIsRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [startDate, setStartDate] = useState(Date.now());
  const [caption, setCaption] = useState('Click me to remove background');

  useEffect(() => {
    let interval = null;
    if (isRunning) {
      interval = setInterval(() => {
        setSeconds(calculateSecondsBetweenDates(startDate, Date.now()));
      }, 100);
    } else {
      clearInterval(interval);
    }
    return () => {
      clearInterval(interval);
    };
  }, [isRunning, startDate]);

  const resetTimer = () => {
    setIsRunning(true);
    setStartDate(Date.now());
    setSeconds(0);
  };

  const stopTimer = () => {
    setIsRunning(false);
  };

  async function load() {
    setIsRunning(true);
    resetTimer();
    setImageUrl(randomImage);

    const imageBlob = await removeBackground(randomImage, {
      publicPath: `${window.location.href}/static/js/`,
      // debug: true,
      progress: (key, current, total) => {
        const [type, subtype] = key.split(':');
        setCaption(
          `${type} ${subtype} ${((current / total) * 100).toFixed(0)}%`
        );
      }
    });

    const url = URL.createObjectURL(imageBlob);

    setImageUrl(url);
    setIsRunning(false);
    stopTimer();
  }

  return (
    <div className="App">
      <header className="App-header">
        <img src={imageUrl} className="App-logo" alt="logo" />
        <p>{caption}</p>
        <p>Testing background removal: {seconds} s</p>
        <button disabled={isRunning} onClick={() => load()}>
          Click me
        </button>
      </header>
    </div>
  );
}

export default App;
