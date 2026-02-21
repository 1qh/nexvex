import ConvexShared
import SwiftUI

internal struct ContentView: View {
    @State private var showOnboarding = false

    @State private var activeOrgID: String?

    @State private var activeOrgName = ""

    @State private var activeRole = ""

    var body: some View {
        AuthenticatedView { signOut in
            if showOnboarding {
                OnboardingView {
                    showOnboarding = false
                }
            } else if let orgID = activeOrgID {
                OrgHomeView(
                    orgID: orgID,
                    orgName: activeOrgName,
                    role: activeRole,
                    onSwitchOrg: {
                        activeOrgID = nil
                    },
                    onSignOut: {
                        activeOrgID = nil
                        signOut()
                    }
                )
            } else {
                // swiftformat:disable trailingClosures
                OrgSwitcherView(
                    onSelectOrg: { orgID, name, role in
                        activeOrgID = orgID
                        activeOrgName = name
                        activeRole = role
                    },
                    onSignOut: signOut
                ) {
                    showOnboarding = true
                }
                // swiftformat:enable trailingClosures
            }
        }
    }
}
