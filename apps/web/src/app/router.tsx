import { createBrowserRouter, Navigate } from 'react-router';
import { HomeScreen } from '../features/home/HomeScreen';
import { SettingsScreen } from '../features/settings/SettingsScreen';
import { UpcomingScreen } from '../features/upcoming/UpcomingScreen';
import { WeightScreen } from '../features/weight/WeightScreen';
import { AppShell } from './AppShell';
import { RouteError } from './RouteError';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <HomeScreen /> },
      { path: 'training', element: <UpcomingScreen module="training" /> },
      { path: 'nutrition', element: <UpcomingScreen module="nutrition" /> },
      { path: 'progression', element: <WeightScreen /> },
      { path: 'coach', element: <UpcomingScreen module="coach" /> },
      { path: 'reglages', element: <SettingsScreen /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
