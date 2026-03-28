import {Router} from 'express';
import {timeSyncService} from '../services/timeSyncService';

export const timeRouter: Router = Router();

// POST /api/time/start - Start de productietijd
timeRouter.post('/start', (req, res) => {
  timeSyncService.start();
  return res.status(200).json({ message: 'Production clock started.' });
});

// POST /api/time/stop - Stop de productietijd
timeRouter.post('/stop', (req, res) => {
  timeSyncService.stop();
  return res.status(200).json({ message: 'Production clock stopped.' });
});

// POST /api/time/countdown - Start een countdown
timeRouter.post('/countdown', (req, res) => {
  const { seconds } = req.body;
  if (typeof seconds !== 'number' || seconds <= 0) {
    return res.status(400).json({ error: 'A positive number of seconds is required.' });
  }
  timeSyncService.setCountdown(seconds);
  return res.status(200).json({ message: `Countdown started from ${seconds} seconds.` });
});

// POST /api/time/venue-clock - Update de zaalklok
timeRouter.post('/venue-clock', (req, res) => {
    const { time } = req.body; // verwacht bijv. "15:34"
    if (typeof time !== 'string') {
        return res.status(400).json({ error: 'Invalid time format.'});
    }
    timeSyncService.updateVenueClock(time);
    return res.status(200).json({ message: 'Venue clock updated.' });
});
