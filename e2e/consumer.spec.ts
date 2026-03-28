import { test, expect } from '@playwright/test';

test.describe('Consumer Portal — /  (text modality)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should render the h1 heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'How can we help?' })).toBeVisible();
  });

  test('should show three tab options: Text, Image, Voice', async ({ page }) => {
    await expect(page.getByRole('tab', { name: 'Text' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Image' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Voice' })).toBeVisible();
  });

  test('should start on Text tab by default', async ({ page }) => {
    const textTab = page.getByRole('tab', { name: 'Text' });
    await expect(textTab).toHaveAttribute('aria-selected', 'true');
  });

  test('should show the textarea on Text tab', async ({ page }) => {
    const textarea = page.getByRole('textbox', { name: /describe your emergency/i });
    await expect(textarea).toBeVisible();
  });

  test('should disable submit button when no input is present', async ({ page }) => {
    const submitBtn = page.getByRole('button', { name: /submit/i });
    await expect(submitBtn).toBeDisabled();
  });

  test('should enable submit button when text is entered', async ({ page }) => {
    await page.getByLabel(/describe/i).fill('There is a fire at 123 Main Street');
    const submitBtn = page.getByRole('button', { name: /submit/i });
    await expect(submitBtn).toBeEnabled();
  });

  test('should show character count as user types', async ({ page }) => {
    const textarea = page.getByRole('textbox', { name: /describe/i });
    await textarea.fill('Hello world');
    await expect(page.getByText(/11\/5000/)).toBeVisible();
  });

  test('should show loading state after submission', async ({ page }) => {
    // Use a promise that never resolves initially so we can catch the loading state
    let resolveRoute!: () => void;
    const routeBlocked = new Promise<void>(resolve => { resolveRoute = resolve; });

    await page.route('/api/ingest', async (route) => {
      await routeBlocked; // hold the response until we've checked loading state
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          document: {
            id: 'test_001',
            intent_summary: 'Car accident on highway',
            urgency: 4,
            recommended_action: 'Dispatch ambulance',
            input_modalities: ['text'],
            attachments: [],
            status: 'pending',
            timestamp: new Date().toISOString(),
            raw_text: 'Car accident on I-95',
          },
        }),
      });
    });

    await page.fill('textarea', 'Car accident on I-95 near exit 42');
    await page.click('button[type="submit"]');

    // Now loading state should be visible since we're holding the route
    await expect(page.getByRole('status')).toBeVisible();
    await expect(page.getByText('Analyzing your request')).toBeVisible();

    // Release the route so the test can clean up
    resolveRoute();
  });

  test('should display LLM extraction result after successful submission', async ({ page }) => {
    await page.route('/api/ingest', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        document: {
          id: 'test_002',
          intent_summary: 'Structure fire at commercial building',
          urgency: 5,
          recommended_action: 'Dispatch fire units and establish perimeter',
          input_modalities: ['text'],
          attachments: [],
          status: 'pending',
          timestamp: new Date().toISOString(),
          raw_text: 'There is a fire',
        },
      }),
    }));

    await page.fill('textarea', 'There is a fire at the warehouse on Oak Street');
    await page.click('button[type="submit"]');

    await expect(page.getByText('LLM Extraction Complete')).toBeVisible();
    await expect(page.getByText('Structure fire at commercial building')).toBeVisible();
    await expect(page.getByText('Level 5 / 5')).toBeVisible();
    await expect(page.getByText('Dispatch fire units and establish perimeter')).toBeVisible();
  });

  test('should show "Test Another Scenario" button after success', async ({ page }) => {
    await page.route('/api/ingest', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        document: {
          id: 'test_003',
          intent_summary: 'Minor road hazard',
          urgency: 2,
          recommended_action: 'Alert road crew',
          input_modalities: ['text'],
          attachments: [],
          status: 'pending',
          timestamp: new Date().toISOString(),
          raw_text: 'Pothole',
        },
      }),
    }));

    await page.fill('textarea', 'Pothole on Main Street');
    await page.click('button[type="submit"]');

    const resetBtn = page.getByRole('button', { name: 'Test Another Scenario' });
    await expect(resetBtn).toBeVisible();
    await resetBtn.click();

    // Should return to idle state with textarea
    await expect(page.getByRole('textbox', { name: /describe/i })).toBeVisible();
  });

  test('should display error state on API failure', async ({ page }) => {
    await page.route('/api/ingest', route => route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Internal Server Error' }),
    }));

    await page.fill('textarea', 'Test emergency input');
    await page.click('button[type="submit"]');

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByText('Processing Error')).toBeVisible();
  });

  test('should display rate limit error on 429 response', async ({ page }) => {
    await page.route('/api/ingest', route => route.fulfill({
      status: 429,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Too many requests' }),
    }));

    await page.fill('textarea', 'Test');
    await page.click('button[type="submit"]');

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByText('Rate Limit Reached')).toBeVisible();
  });
});

test.describe('Consumer Portal — Tab Navigation', () => {
  test('should switch to Image tab and show upload zone', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Image' }).click();
    await expect(page.getByRole('button', { name: /upload an image/i })).toBeVisible();
  });

  test('should switch to Voice tab and show record button', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Voice' }).click();
    await expect(page.getByRole('button', { name: /start voice recording/i })).toBeVisible();
  });

  test('should set aria-selected correctly when switching tabs', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Image' }).click();
    await expect(page.getByRole('tab', { name: 'Image' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tab', { name: 'Text' })).toHaveAttribute('aria-selected', 'false');
  });
});

test.describe('Consumer Portal — Accessibility', () => {
  test('should have a skip-to-content link', async ({ page }) => {
    await page.goto('/');
    const skipLink = page.getByText('Skip to intake form');
    await expect(skipLink).toBeAttached();
  });

  test('should have correct page title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Universal Bridge/i);
  });

  test('should have lang attribute on html element', async ({ page }) => {
    await page.goto('/');
    const lang = await page.locator('html').getAttribute('lang');
    expect(lang).toBe('en');
  });
});
