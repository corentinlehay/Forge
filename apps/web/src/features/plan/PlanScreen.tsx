import { useNavigate } from 'react-router';
import { useToast } from '../../ui/Toast';
import { PlanQuestionnaire } from './PlanQuestionnaire';

/** Refaire le questionnaire depuis les réglages. */
export function PlanScreen() {
  const navigate = useNavigate();
  const toast = useToast();
  return (
    <PlanQuestionnaire
      mode="settings"
      onCancel={() => navigate('/reglages', { viewTransition: true })}
      onFinished={() => {
        toast.show('Plan adopté');
        navigate('/training', { viewTransition: true });
      }}
    />
  );
}
