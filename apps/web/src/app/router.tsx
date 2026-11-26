import { createBrowserRouter, Navigate } from 'react-router';
import { CoachScreen } from '../features/coach/CoachScreen';
import { HomeScreen } from '../features/home/HomeScreen';
import { AddFoodScreen } from '../features/nutrition/AddFoodScreen';
import { NutritionScreen } from '../features/nutrition/NutritionScreen';
import { ProgressionScreen } from '../features/progression/ProgressionScreen';
import { SettingsScreen } from '../features/settings/SettingsScreen';
import { TrainingScreen } from '../features/training/TrainingScreen';
import { WorkoutScreen } from '../features/training/WorkoutScreen';
import { TemplateScreen } from '../features/training/TemplateScreen';
import { ProgramScreen, ProgramsScreen } from '../features/programs/ProgramsScreen';
import { ProgramFormScreen } from '../features/programs/ProgramForm';
import { ProgramGeneratorScreen } from '../features/programs/ProgramGenerator';
import { ProgramVersionScreen, ProgramVersionsScreen } from '../features/programs/ProgramVersions';
import { ExerciseLibraryScreen } from '../features/training/ExerciseLibraryScreen';
import { ExerciseDetailScreen } from '../features/training/ExerciseDetailScreen';
import { PlanScreen } from '../features/plan/PlanScreen';
import { ObjectivesScreen } from '../features/objectives/ObjectivesScreen';
import { BudgetScreen } from '../features/budget/BudgetScreen';
import { MindScreen } from '../features/mind/MindScreen';
import { JournalScreen } from '../features/mind/JournalScreen';
import { SleepScreen } from '../features/mind/SleepScreen';
import { LibraryScreen, PreparationScreen } from '../features/mind/LibraryScreens';
import { ExerciseScreen, RoutineScreen } from '../features/mind/PracticeScreens';
import { RoutineEditor } from '../features/mind/RoutineEditor';
import { AudioDetailScreen, AudioLibraryScreen, HypnosisScreen } from '../features/audio/AudioScreens';
import { CreatorEditor, CreatorScreen } from '../features/audio/CreatorScreen';
import { CompareScreen, MeasurementsScreen, PhotosScreen } from '../features/body/BodyScreens';
import { PainDetailScreen } from '../features/body/PainScreens';
import { ReviewScreen } from '../features/review/ReviewScreen';
import { PulseHistoryScreen } from '../features/pulse/PulseHistoryScreen';
import { PulseScreen } from '../features/pulse/PulseScreen';
import { PulseSettingsScreen } from '../features/pulse/PulseSettingsScreen';
import { KitchenScreen } from '../features/kitchen/KitchenScreen';
import { RecipeScreen } from '../features/kitchen/RecipeScreen';
import { RecipeEditor } from '../features/kitchen/RecipeEditor';
import { ComposeScreen } from '../features/kitchen/ComposeScreen';
import { PlanningScreen } from '../features/kitchen/PlanningScreen';
import { ShoppingListScreen, ShoppingListsScreen } from '../features/kitchen/ShoppingScreen';
import { MusclesScreen } from '../features/muscles/MusclesScreen';
import { MuscleDetailScreen } from '../features/muscles/MuscleDetailScreen';
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
      { path: 'training/programme/:templateId', element: <TemplateScreen /> },
      { path: 'training/programmes', element: <ProgramsScreen /> },
      { path: 'training/programmes/nouveau', element: <ProgramFormScreen /> },
      { path: 'training/programmes/generer', element: <ProgramGeneratorScreen /> },
      { path: 'training/programmes/:id', element: <ProgramScreen /> },
      { path: 'training/programmes/:id/modifier', element: <ProgramFormScreen /> },
      { path: 'training/programmes/:id/versions', element: <ProgramVersionsScreen /> },
      { path: 'training/programmes/:id/versions/:versionId', element: <ProgramVersionScreen /> },
      { path: 'training/exercices', element: <ExerciseLibraryScreen /> },
      { path: 'training/exercices/:key', element: <ExerciseDetailScreen /> },
      { path: 'reglages/plan', element: <PlanScreen /> },
      { path: 'nutrition/recettes', element: <KitchenScreen /> },
      { path: 'nutrition/recettes/nouvelle', element: <RecipeEditor /> },
      { path: 'nutrition/recettes/:key', element: <RecipeScreen /> },
      { path: 'nutrition/recettes/:key/modifier', element: <RecipeEditor /> },
      { path: 'nutrition/compose', element: <ComposeScreen /> },
      { path: 'nutrition/objectifs', element: <ObjectivesScreen /> },
      { path: 'nutrition/budget', element: <BudgetScreen /> },
      { path: 'nutrition/planning', element: <PlanningScreen /> },
      { path: 'nutrition/courses', element: <ShoppingListsScreen /> },
      { path: 'nutrition/courses/:id', element: <ShoppingListScreen /> },
      { path: 'training/muscles', element: <MusclesScreen /> },
      { path: 'training/muscles/:muscle', element: <MuscleDetailScreen /> },
      { path: 'nutrition', element: <NutritionScreen /> },
      { path: 'nutrition/ajouter', element: <AddFoodScreen /> },
      { path: 'progression', element: <ProgressionScreen /> },
      { path: 'progression/mensurations', element: <MeasurementsScreen /> },
      { path: 'progression/photos', element: <PhotosScreen /> },
      { path: 'progression/comparer', element: <CompareScreen /> },
      { path: 'progression/douleur/:id', element: <PainDetailScreen /> },
      { path: 'progression/bilans', element: <ReviewScreen /> },
      { path: 'pulse', element: <PulseScreen /> },
      { path: 'pulse/reglages', element: <PulseSettingsScreen /> },
      { path: 'pulse/historique', element: <PulseHistoryScreen /> },
      { path: 'mind', element: <MindScreen /> },
      { path: 'mind/journal', element: <JournalScreen /> },
      { path: 'mind/sommeil', element: <SleepScreen /> },
      { path: 'mind/exercices', element: <LibraryScreen /> },
      { path: 'mind/preparation', element: <PreparationScreen /> },
      { path: 'mind/exercice/:id', element: <ExerciseScreen /> },
      { path: 'mind/routine/:id', element: <RoutineScreen /> },
      { path: 'mind/routine/:id/modifier', element: <RoutineEditor /> },
      { path: 'mind/audio', element: <AudioLibraryScreen /> },
      { path: 'mind/audio/:id', element: <AudioDetailScreen /> },
      { path: 'mind/hypnose', element: <HypnosisScreen /> },
      { path: 'mind/createur', element: <CreatorScreen /> },
      { path: 'mind/createur/:id', element: <CreatorEditor /> },
      { path: 'coach', element: <CoachScreen /> },
      { path: 'reglages', element: <SettingsScreen /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
