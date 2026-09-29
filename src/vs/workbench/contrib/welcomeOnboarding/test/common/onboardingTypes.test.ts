/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { getOnboardingStepSubtitle, getOnboardingStepTitle, ONBOARDING_STEPS, ONBOARDING_STORAGE_KEY, OnboardingStepId } from '../../common/onboardingTypes.js';

suite('onboardingTypes', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('orders the .NET toolchain step before personalization', () => {
		assert.deepStrictEqual(ONBOARDING_STEPS, [OnboardingStepId.DotnetToolchain, OnboardingStepId.Personalize]);
	});

	test('provides localized titles and subtitles for the account-free flow', () => {
		assert.deepStrictEqual([
			[getOnboardingStepTitle(OnboardingStepId.DotnetToolchain), getOnboardingStepSubtitle(OnboardingStepId.DotnetToolchain)],
			[getOnboardingStepTitle(OnboardingStepId.Personalize), getOnboardingStepSubtitle(OnboardingStepId.Personalize)],
		], [
			['Set up .NET toolchain', 'Set up the .NET SDK on this machine to build and run .NET projects'],
			['Make It Yours', 'Choose your theme and keyboard mapping'],
		]);
	});

	test('preserves the onboarding completion storage key', () => {
		assert.strictEqual(ONBOARDING_STORAGE_KEY, 'welcomeOnboarding.state');
	});
});
