import { test, expect } from '@playwright/test';

const mockIntents = [
  {
    id: 'intent_abc123',
    intent_summary: 'Structure fire at industrial complex',
    urgency: 5,
    recommended_action: 'Dispatch fire units immediately',
    input_modalities: ['text', 'image'],
    attachments: [{ type: 'image', gcs_uri: 'local://img', public_url: 'http://localhost/img', original_name: 'fire.jpg', mime_type: 'image/jpeg' }],
    status: 'pending',
    timestamp: new Date().toISOString(),
    raw_text: 'Fire at the factory',
  },
  {
    id: 'intent_def456',
    intent_summary: 'Minor traffic incident on side street',
    urgency: 2,
    recommended_action: 'Send non-emergency police',
    input_modalities: ['text'],
    attachments: [],
    status: 'acknowledged',
    timestamp: new Date(Date.now() - 60000).toISOString(),
    raw_text: 'Fender bender on Oak Ave',
  },
];

test.describe('Operator Dashboard — /operator', () => {
  test.beforeEach(async ({ page }) => {
    // Mock the polling endpoint to return controlled data
    await page.route('/api/ingest', route => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ intents: mockIntents }),
        });
      }
      return route.continue();
    });

    await page.goto('/operator');
  });

  test('should render the Command Center heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Command Center/i })).toBeVisible();
  });

  test('should show System Online badge', async ({ page }) => {
    await expect(page.getByText('System Online')).toBeVisible();
  });

  test('should display all incidents from the feed', async ({ page }) => {
    await expect(page.getByText('Structure fire at industrial complex')).toBeVisible();
    await expect(page.getByText('Minor traffic incident on side street')).toBeVisible();
  });

  test('should show critical incident counter in header', async ({ page }) => {
    // 1 critical (urgency 5, pending) out of 2 intents
    await expect(page.getByText('1 CRITICAL')).toBeVisible();
  });

  test('should display urgency level badge correctly', async ({ page }) => {
    await expect(page.getByText('SEVERITY 5')).toBeVisible();
    await expect(page.getByText('SEVERITY 2')).toBeVisible();
  });

  test('should show Acknowledge button for pending incidents', async ({ page }) => {
    const ackBtn = page.getByRole('button', { name: /acknowledge incident/i }).first();
    await expect(ackBtn).toBeVisible();
  });

  test('should show Acknowledged label for acknowledged incidents', async ({ page }) => {
    await expect(page.getByText('Acknowledged').first()).toBeVisible();
  });

  test('should show modality badges (text, image) on incident cards', async ({ page }) => {
    // First incident has ['text', 'image']
    await expect(page.getByText('image').first()).toBeVisible();
  });

  test('should show attachment tags on incident cards', async ({ page }) => {
    await expect(page.getByText('fire.jpg')).toBeVisible();
  });

  test('should show the recommended action', async ({ page }) => {
    await expect(page.getByText('Dispatch fire units immediately')).toBeVisible();
  });

  test('should display queue count', async ({ page }) => {
    // 1 pending intent
    const queueSection = page.locator('text=Queue:');
    await expect(queueSection).toBeVisible();
  });

  test('should call PATCH when acknowledge button is clicked', async ({ page }) => {
    let patchBody: unknown = null;

    await page.route('/api/ingest', route => {
      if (route.request().method() === 'PATCH') {
        patchBody = route.request().postDataJSON();
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      }
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ intents: mockIntents }),
        });
      }
      return route.continue();
    });

    await page.reload();
    const ackBtn = page.getByRole('button', { name: /acknowledge incident/i }).first();
    await ackBtn.click();

    // Give optimistic update a moment
    await page.waitForTimeout(200);

    expect(patchBody).toMatchObject({ id: 'intent_abc123', status: 'acknowledged' });
  });
});

test.describe('Operator Dashboard — Empty State', () => {
  test('should show empty state message when no intents exist', async ({ page }) => {
    await page.route('/api/ingest', route => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ intents: [] }),
        });
      }
      return route.continue();
    });

    await page.goto('/operator');
    await expect(page.getByText('No active incidents in the pipeline.')).toBeVisible();
  });
});

test.describe('Operator Dashboard — Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('/api/ingest', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ intents: [] }),
    }));
    await page.goto('/operator');
  });

  test('should have a skip-to-content link', async ({ page }) => {
    await expect(page.getByText('Skip to incident feed')).toBeAttached();
  });

  test('should have correct page title', async ({ page }) => {
    await expect(page).toHaveTitle(/Universal Bridge/i);
  });
});
