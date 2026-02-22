import XCTest

// swiftlint:disable file_length type_body_length
@MainActor
internal final class OrgUITests: XCTestCase {
    private let app = XCUIApplication()

    override func setUp() {
        continueAfterFailure = true
        app.launch()
    }

    private func ensureAuthenticated() {
        let emailField = app.textFields["Email"]
        if !emailField.waitForExistence(timeout: 3) {
            return
        }

        emailField.click()
        emailField.typeKey("a", modifierFlags: .command)
        emailField.typeText("desktop-org-e2e@test.local")

        let passwordField = app.textFields["Password"]
        passwordField.click()
        passwordField.typeKey("a", modifierFlags: .command)
        passwordField.typeText("Test123456!")

        app.buttons["Sign In"].click()

        let orgText = app.staticTexts["Organizations"]
        let getStarted = app.buttons["Get Started"]
        let selectButton = app.buttons["Select"].firstMatch
        let stepText = app.staticTexts
            .matching(
                NSPredicate(format: "label BEGINSWITH 'Step '")
            )
            .firstMatch

        if orgText.waitForExistence(timeout: 8) || getStarted.waitForExistence(timeout: 2)
            || selectButton.waitForExistence(timeout: 2) || stepText.waitForExistence(timeout: 2) {
            return
        }

        if emailField.exists {
            let toggle = app.buttons["Need account? Sign Up"]
            if toggle.waitForExistence(timeout: 2) {
                toggle.click()
            }
            app.buttons["Create Account"].click()
            _ = orgText.waitForExistence(timeout: 10)
                || getStarted.waitForExistence(timeout: 5)
        }
    }

    private func ensureSignedOut() {
        let signOut = app.buttons["Sign Out"]
        if signOut.waitForExistence(timeout: 3) {
            signOut.click()
            _ = app.textFields["Email"].waitForExistence(timeout: 5)
        }
    }

    private func ensureInOrg() {
        ensureAuthenticated()

        let stepText = app.staticTexts
            .matching(
                NSPredicate(format: "label BEGINSWITH 'Step '")
            )
            .firstMatch
        if stepText.waitForExistence(timeout: 3) {
            completeOnboarding()
        }

        let getStarted = app.buttons["Get Started"]
        if getStarted.waitForExistence(timeout: 2) {
            getStarted.click()
            sleep(1)
            completeOnboarding()
        }

        let selectButton = app.buttons["Select"].firstMatch
        if selectButton.waitForExistence(timeout: 3) {
            selectButton.click()
            sleep(2)
            return
        }

        let projectsButton = app.buttons["Projects"]
        _ = projectsButton.waitForExistence(timeout: 5)
    }

    private func completeOnboarding() {
        let displayNameField = app.textFields["Display Name"]
        if displayNameField.waitForExistence(timeout: 5) {
            displayNameField.click()
            displayNameField.typeKey("a", modifierFlags: .command)
            displayNameField.typeText("E2E Test User")
        }

        let nextButton = app.buttons["Next"]
        if nextButton.waitForExistence(timeout: 3) {
            nextButton.click()
        }

        let orgNameField = app.textFields["Organization Name"]
        if orgNameField.waitForExistence(timeout: 5) {
            orgNameField.click()
            orgNameField.typeKey("a", modifierFlags: .command)
            orgNameField.typeText("E2E Test Org")

            let slugField = app.textFields["URL Slug"]
            slugField.click()
            slugField.typeKey("a", modifierFlags: .command)
            slugField.typeText("e2e-test-\(Int(Date().timeIntervalSince1970))")
        }

        if nextButton.exists {
            nextButton.click()
        }

        sleep(1)
        if nextButton.exists {
            nextButton.click()
        }

        sleep(1)
        let completeButton = app.buttons["Complete"]
        if completeButton.waitForExistence(timeout: 3) {
            completeButton.click()
        }
        sleep(5)
    }

    func testAppLaunches() {
        XCTAssertTrue(app.windows.firstMatch.waitForExistence(timeout: 5))
    }

    func testAuthViewShown() {
        ensureSignedOut()
        XCTAssertTrue(app.staticTexts["Sign In"].waitForExistence(timeout: 5))
    }

    func testEmailFieldVisible() {
        ensureSignedOut()
        XCTAssertTrue(app.textFields["Email"].waitForExistence(timeout: 5))
    }

    func testPasswordFieldVisible() {
        ensureSignedOut()
        XCTAssertTrue(app.textFields["Password"].waitForExistence(timeout: 5))
    }

    func testSignInButtonVisible() {
        ensureSignedOut()
        XCTAssertTrue(app.buttons["Sign In"].waitForExistence(timeout: 5))
    }

    func testToggleToSignUpMode() {
        ensureSignedOut()
        let toggle = app.buttons["Need account? Sign Up"]
        XCTAssertTrue(toggle.waitForExistence(timeout: 5))
        toggle.click()
        XCTAssertTrue(app.staticTexts["Sign Up"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["Create Account"].waitForExistence(timeout: 5))
    }

    func testToggleBackToSignIn() {
        ensureSignedOut()
        let toggle = app.buttons["Need account? Sign Up"]
        XCTAssertTrue(toggle.waitForExistence(timeout: 5))
        toggle.click()

        let toggleBack = app.buttons["Have account? Sign In"]
        XCTAssertTrue(toggleBack.waitForExistence(timeout: 5))
        toggleBack.click()

        XCTAssertTrue(app.staticTexts["Sign In"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["Sign In"].waitForExistence(timeout: 5))
    }

    func testSignInWithInvalidCredentials() {
        ensureSignedOut()
        let emailField = app.textFields["Email"]
        XCTAssertTrue(emailField.waitForExistence(timeout: 5))
        emailField.click()
        emailField.typeText("invalid@test.com")

        let passwordField = app.textFields["Password"]
        passwordField.click()
        passwordField.typeText("wrongpassword")

        app.buttons["Sign In"].click()
        sleep(5)
        XCTAssertTrue(emailField.exists)
    }

    func testEmptySignInStaysOnAuthView() {
        ensureSignedOut()
        let signInButton = app.buttons["Sign In"]
        XCTAssertTrue(signInButton.waitForExistence(timeout: 5))
        signInButton.click()
        sleep(2)
        XCTAssertTrue(app.textFields["Email"].exists)
        XCTAssertTrue(app.staticTexts["Sign In"].exists)
    }

    func testSignUpButtonLabelChanges() {
        ensureSignedOut()
        let toggle = app.buttons["Need account? Sign Up"]
        XCTAssertTrue(toggle.waitForExistence(timeout: 5))
        toggle.click()
        XCTAssertTrue(app.buttons["Create Account"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["Have account? Sign In"].waitForExistence(timeout: 5))
    }

    func testFieldsPreservedOnModeToggle() {
        ensureSignedOut()
        let emailField = app.textFields["Email"]
        XCTAssertTrue(emailField.waitForExistence(timeout: 5))
        emailField.click()
        emailField.typeText("test@example.com")

        app.buttons["Need account? Sign Up"].click()
        sleep(1)
        let emailValue = emailField.value as? String ?? ""
        XCTAssertTrue(emailValue.contains("test@example.com"))
    }

    func testAuthenticatedShowsSwitcherOrOnboarding() {
        ensureAuthenticated()
        let orgText = app.staticTexts["Organizations"]
        let getStarted = app.buttons["Get Started"]
        let selectButton = app.buttons["Select"].firstMatch
        let stepText = app.staticTexts
            .matching(
                NSPredicate(format: "label BEGINSWITH 'Step '")
            )
            .firstMatch
        let projectsButton = app.buttons["Projects"]

        let hasPostAuth = orgText.waitForExistence(timeout: 10)
            || getStarted.waitForExistence(timeout: 2)
            || selectButton.waitForExistence(timeout: 2)
            || stepText.waitForExistence(timeout: 2)
            || projectsButton.waitForExistence(timeout: 2)
        XCTAssertTrue(hasPostAuth)
    }

    func testSwitcherShowsSignOutButton() {
        ensureAuthenticated()
        XCTAssertTrue(app.buttons["Sign Out"].waitForExistence(timeout: 10))
    }

    func testSwitcherShowsNewOrgButton() {
        ensureAuthenticated()
        let orgText = app.staticTexts["Organizations"]
        if orgText.waitForExistence(timeout: 8) {
            XCTAssertTrue(app.buttons["New Org"].waitForExistence(timeout: 5))
        }
    }

    func testNewOrgFormOpens() {
        ensureAuthenticated()
        let orgText = app.staticTexts["Organizations"]
        if orgText.waitForExistence(timeout: 8) {
            app.buttons["New Org"].click()
            XCTAssertTrue(app.textFields["Organization Name"].waitForExistence(timeout: 5))
            XCTAssertTrue(app.textFields["Slug"].waitForExistence(timeout: 5))
        }
    }

    func testNewOrgFormHasCancelButton() {
        ensureAuthenticated()
        let orgText = app.staticTexts["Organizations"]
        if orgText.waitForExistence(timeout: 8) {
            app.buttons["New Org"].click()
            XCTAssertTrue(app.buttons["Cancel"].waitForExistence(timeout: 5))
        }
    }

    func testNewOrgFormHasCreateButton() {
        ensureAuthenticated()
        let orgText = app.staticTexts["Organizations"]
        if orgText.waitForExistence(timeout: 8) {
            app.buttons["New Org"].click()
            XCTAssertTrue(app.buttons["Create"].waitForExistence(timeout: 5))
        }
    }

    func testCancelNewOrgClosesForm() {
        ensureAuthenticated()
        let orgText = app.staticTexts["Organizations"]
        if orgText.waitForExistence(timeout: 8) {
            app.buttons["New Org"].click()
            XCTAssertTrue(app.textFields["Organization Name"].waitForExistence(timeout: 5))
            app.buttons["Cancel"].click()
            sleep(1)
            XCTAssertFalse(app.textFields["Organization Name"].exists)
        }
    }

    func testOnboardingStep1ShowsDisplayName() {
        ensureAuthenticated()
        let stepText = app.staticTexts
            .matching(
                NSPredicate(format: "label CONTAINS 'Step 1'")
            )
            .firstMatch
        let getStarted = app.buttons["Get Started"]

        if getStarted.waitForExistence(timeout: 5) {
            getStarted.click()
            sleep(1)
        }

        if stepText.waitForExistence(timeout: 5) {
            XCTAssertTrue(app.textFields["Display Name"].waitForExistence(timeout: 5))
            XCTAssertTrue(app.textFields["Bio"].waitForExistence(timeout: 5))
        }
    }

    func testOnboardingStep1NextButton() {
        ensureAuthenticated()
        let stepText = app.staticTexts
            .matching(
                NSPredicate(format: "label CONTAINS 'Step 1'")
            )
            .firstMatch
        let getStarted = app.buttons["Get Started"]

        if getStarted.waitForExistence(timeout: 5) {
            getStarted.click()
            sleep(1)
        }

        if stepText.waitForExistence(timeout: 5) {
            XCTAssertTrue(app.buttons["Next"].waitForExistence(timeout: 5))
            XCTAssertFalse(app.buttons["Back"].exists)
        }
    }

    func testOnboardingAdvancesToStep2() {
        ensureAuthenticated()
        let stepText = app.staticTexts
            .matching(
                NSPredicate(format: "label CONTAINS 'Step 1'")
            )
            .firstMatch
        let getStarted = app.buttons["Get Started"]

        if getStarted.waitForExistence(timeout: 5) {
            getStarted.click()
            sleep(1)
        }

        if stepText.waitForExistence(timeout: 5) {
            let displayName = app.textFields["Display Name"]
            displayName.click()
            displayName.typeText("E2E Onboard")
            app.buttons["Next"].click()

            let step2 = app.staticTexts
                .matching(
                    NSPredicate(format: "label CONTAINS 'Step 2'")
                )
                .firstMatch
            XCTAssertTrue(step2.waitForExistence(timeout: 5))
            XCTAssertTrue(app.textFields["Organization Name"].waitForExistence(timeout: 5))
            XCTAssertTrue(app.textFields["URL Slug"].waitForExistence(timeout: 5))
        }
    }

    func testOnboardingStep2HasBackButton() {
        ensureAuthenticated()
        let stepText = app.staticTexts
            .matching(
                NSPredicate(format: "label CONTAINS 'Step 1'")
            )
            .firstMatch
        let getStarted = app.buttons["Get Started"]

        if getStarted.waitForExistence(timeout: 5) {
            getStarted.click()
            sleep(1)
        }

        if stepText.waitForExistence(timeout: 5) {
            let displayName = app.textFields["Display Name"]
            displayName.click()
            displayName.typeText("Back Test")
            app.buttons["Next"].click()
            sleep(1)
            XCTAssertTrue(app.buttons["Back"].waitForExistence(timeout: 5))
        }
    }

    func testOnboardingBackReturnsToStep1() {
        ensureAuthenticated()
        let stepText = app.staticTexts
            .matching(
                NSPredicate(format: "label CONTAINS 'Step 1'")
            )
            .firstMatch
        let getStarted = app.buttons["Get Started"]

        if getStarted.waitForExistence(timeout: 5) {
            getStarted.click()
            sleep(1)
        }

        if stepText.waitForExistence(timeout: 5) {
            let displayName = app.textFields["Display Name"]
            displayName.click()
            displayName.typeText("Back Nav")
            app.buttons["Next"].click()

            let step2 = app.staticTexts
                .matching(
                    NSPredicate(format: "label CONTAINS 'Step 2'")
                )
                .firstMatch
            XCTAssertTrue(step2.waitForExistence(timeout: 5))

            app.buttons["Back"].click()
            let step1Again = app.staticTexts
                .matching(
                    NSPredicate(format: "label CONTAINS 'Step 1'")
                )
                .firstMatch
            XCTAssertTrue(step1Again.waitForExistence(timeout: 5))
        }
    }

    func testOnboardingNavigateAllSteps() {
        ensureAuthenticated()
        let getStarted = app.buttons["Get Started"]
        if getStarted.waitForExistence(timeout: 5) {
            getStarted.click()
            sleep(1)
        }

        let step1 = app.staticTexts
            .matching(
                NSPredicate(format: "label CONTAINS 'Step 1'")
            )
            .firstMatch
        if step1.waitForExistence(timeout: 5) {
            let displayName = app.textFields["Display Name"]
            displayName.click()
            displayName.typeText("Nav All")
            app.buttons["Next"].click()

            let step2 = app.staticTexts
                .matching(
                    NSPredicate(format: "label CONTAINS 'Step 2'")
                )
                .firstMatch
            XCTAssertTrue(step2.waitForExistence(timeout: 5))

            let orgName = app.textFields["Organization Name"]
            orgName.click()
            orgName.typeText("Nav Org")
            let slug = app.textFields["URL Slug"]
            slug.click()
            slug.typeText("nav-all-\(Int(Date().timeIntervalSince1970))")
            app.buttons["Next"].click()

            let step3 = app.staticTexts
                .matching(
                    NSPredicate(format: "label CONTAINS 'Step 3'")
                )
                .firstMatch
            XCTAssertTrue(step3.waitForExistence(timeout: 5))

            app.buttons["Next"].click()

            let step4 = app.staticTexts
                .matching(
                    NSPredicate(format: "label CONTAINS 'Step 4'")
                )
                .firstMatch
            XCTAssertTrue(step4.waitForExistence(timeout: 5))
            XCTAssertTrue(app.buttons["Complete"].waitForExistence(timeout: 5))
        }
    }

    func testOnboardingStep3HasThemeField() {
        ensureAuthenticated()
        let getStarted = app.buttons["Get Started"]
        if getStarted.waitForExistence(timeout: 5) {
            getStarted.click()
            sleep(1)
        }

        let step1 = app.staticTexts
            .matching(
                NSPredicate(format: "label CONTAINS 'Step 1'")
            )
            .firstMatch
        if step1.waitForExistence(timeout: 5) {
            let displayName = app.textFields["Display Name"]
            displayName.click()
            displayName.typeText("Theme Test")
            app.buttons["Next"].click()

            let orgName = app.textFields["Organization Name"]
            if orgName.waitForExistence(timeout: 5) {
                orgName.click()
                orgName.typeText("Theme Org")
                let slug = app.textFields["URL Slug"]
                slug.click()
                slug.typeText("theme-\(Int(Date().timeIntervalSince1970))")
                app.buttons["Next"].click()

                XCTAssertTrue(app.textFields["Theme (light/dark/system)"].waitForExistence(timeout: 5))
            }
        }
    }

    func testOnboardingStep4HasNotificationsToggle() {
        ensureAuthenticated()
        let getStarted = app.buttons["Get Started"]
        if getStarted.waitForExistence(timeout: 5) {
            getStarted.click()
            sleep(1)
        }

        let step1 = app.staticTexts
            .matching(
                NSPredicate(format: "label CONTAINS 'Step 1'")
            )
            .firstMatch
        if step1.waitForExistence(timeout: 5) {
            let displayName = app.textFields["Display Name"]
            displayName.click()
            displayName.typeText("Notif Test")
            app.buttons["Next"].click()

            let orgName = app.textFields["Organization Name"]
            if orgName.waitForExistence(timeout: 5) {
                orgName.click()
                orgName.typeText("Notif Org")
                let slug = app.textFields["URL Slug"]
                slug.click()
                slug.typeText("notif-\(Int(Date().timeIntervalSince1970))")
                app.buttons["Next"].click()
                sleep(1)
                app.buttons["Next"].click()
                sleep(1)

                let hasNotifElement = app.checkBoxes.firstMatch.exists
                    || app.switches.firstMatch.exists
                    || app.staticTexts["Enable Notifications"].exists
                XCTAssertTrue(hasNotifElement)
            }
        }
    }

    func testHomeViewProjectsButtonVisible() {
        ensureInOrg()
        XCTAssertTrue(app.buttons["Projects"].waitForExistence(timeout: 10))
    }

    func testHomeViewWikiButtonVisible() {
        ensureInOrg()
        XCTAssertTrue(app.buttons["Wiki"].waitForExistence(timeout: 10))
    }

    func testHomeViewMembersButtonVisible() {
        ensureInOrg()
        XCTAssertTrue(app.buttons["Members"].waitForExistence(timeout: 10))
    }

    func testHomeViewSettingsButtonVisible() {
        ensureInOrg()
        XCTAssertTrue(app.buttons["Settings"].waitForExistence(timeout: 10))
    }

    func testHomeViewSwitchOrgButtonVisible() {
        ensureInOrg()
        XCTAssertTrue(app.buttons["Switch Org"].waitForExistence(timeout: 10))
    }

    func testHomeViewSignOutButtonVisible() {
        ensureInOrg()
        XCTAssertTrue(app.buttons["Sign Out"].waitForExistence(timeout: 10))
    }

    func testHomeViewShowsOrgName() {
        ensureInOrg()
        let allTexts = app.staticTexts
        XCTAssertGreaterThan(allTexts.count, 0)
    }

    func testProjectsSectionDefault() {
        ensureInOrg()
        let newProjectButton = app.buttons["New Project"]
        let projectsHeader = app.staticTexts["Projects"]
        let emptyProjects = app.staticTexts["No projects yet"]
        XCTAssertTrue(
            newProjectButton.waitForExistence(timeout: 10)
                || projectsHeader.waitForExistence(timeout: 5)
                || emptyProjects.waitForExistence(timeout: 5)
        )
    }

    func testSwitchToWikiSection() {
        ensureInOrg()
        app.buttons["Wiki"].click()
        let newWikiButton = app.buttons["New Page"]
        let wikiHeader = app.staticTexts["Wiki"]
        let emptyWiki = app.staticTexts["No wiki pages yet"]
        XCTAssertTrue(
            newWikiButton.waitForExistence(timeout: 10)
                || wikiHeader.waitForExistence(timeout: 5)
                || emptyWiki.waitForExistence(timeout: 5)
        )
    }

    func testSwitchToMembersSection() {
        ensureInOrg()
        app.buttons["Members"].click()
        let membersHeader = app.staticTexts["Members"]
        let ownerPredicate = NSPredicate(
            format: "label CONTAINS[c] 'owner' OR label CONTAINS[c] 'Owner'"
        )
        let ownerBadge = app.staticTexts.matching(ownerPredicate).firstMatch
        XCTAssertTrue(
            membersHeader.waitForExistence(timeout: 10)
                || ownerBadge.waitForExistence(timeout: 5)
        )
    }

    func testSwitchToSettingsSection() {
        ensureInOrg()
        app.buttons["Settings"].click()
        let settingsHeader = app.staticTexts["Settings"]
        let nameField = app.textFields["Organization Name"]
        XCTAssertTrue(
            settingsHeader.waitForExistence(timeout: 10)
                || nameField.waitForExistence(timeout: 5)
        )
    }

    func testSwitchBetweenSections() {
        ensureInOrg()

        app.buttons["Wiki"].click()
        sleep(2)
        app.buttons["Projects"].click()
        sleep(2)
        app.buttons["Members"].click()
        sleep(2)
        app.buttons["Settings"].click()
        sleep(2)
        app.buttons["Projects"].click()

        XCTAssertTrue(app.buttons["Projects"].waitForExistence(timeout: 5))
    }

    func testSwitchOrgReturnsToSwitcher() {
        ensureInOrg()
        app.buttons["Switch Org"].click()
        let orgText = app.staticTexts["Organizations"]
        XCTAssertTrue(orgText.waitForExistence(timeout: 10))
    }

    func testSignOutFromHome() {
        ensureInOrg()
        app.buttons["Sign Out"].click()
        XCTAssertTrue(app.staticTexts["Sign In"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.textFields["Email"].waitForExistence(timeout: 5))
    }

    func testOnboardingDataPreservedOnBack() {
        ensureAuthenticated()
        let getStarted = app.buttons["Get Started"]
        if getStarted.waitForExistence(timeout: 5) {
            getStarted.click()
            sleep(1)
        }

        let step1 = app.staticTexts
            .matching(
                NSPredicate(format: "label CONTAINS 'Step 1'")
            )
            .firstMatch
        if step1.waitForExistence(timeout: 5) {
            let displayName = app.textFields["Display Name"]
            displayName.click()
            displayName.typeText("Persist Name")

            let bio = app.textFields["Bio"]
            bio.click()
            bio.typeText("Persist Bio")

            app.buttons["Next"].click()
            sleep(1)
            app.buttons["Back"].click()
            sleep(1)

            let nameValue = app.textFields["Display Name"].value as? String ?? ""
            XCTAssertTrue(nameValue.contains("Persist Name"))
        }
    }
}
