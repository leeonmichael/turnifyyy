import { api } from './client';

export function registerPushToken(pushToken: string) {
  return api.post('/register-push-token/', { push_token: pushToken });
}
