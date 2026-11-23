import { createBrowserRouter, Navigate } from 'react-router';
import { CoachScreen } from '../features/coach/CoachScreen';
import { HomeScreen } from '../features/home/HomeScreen';
import { AddFoodScreen } from '../features/nutrition/AddFoodScreen';
import { NutritionScreen } from '../features/nutrition/NutritionScreen';
import { ProgressionScreen } from '../features/progression/ProgressionScreen';
import { SettingsScreen } from '../features/settings/SettingsScreen';
import { TrainingScreen } from '../features/training/TrainingScreen';
import { WorkoutScreen } from '../features/training/WorkoutScreen';
import { AppShell } from './AppShell';
import { RouteError } from './RouteError';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <HomeScreen /> },
      { path: 'training', element: <TrainingScreen /> },
      { path: 'training/seance/:id', element: <WorkoutScreen /> },
      { path: 'nutrition', element: <NutritionScreen /> },
      { path: 'nutrition/ajouter', element: <AddFoodScreen /> },
      { path: 'progression', element: <ProgressionScreen /> },
      { path: 'coach', element: <CoachScreen /> },
      { path: 'reglages', element: <SettingsScreen /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
