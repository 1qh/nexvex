import ConvexShared
import SwiftUI

internal enum OrgTab: String, Hashable {
    case members
    case projects
    case settings
    case wiki
}

internal struct OrgHomeView: View {
    let orgID: String

    let orgName: String

    let role: String

    let onSwitchOrg: () -> Void

    let onSignOut: () -> Void

    @State private var selectedTab = OrgTab.projects

    var body: some View {
        TabView(selection: $selectedTab) {
            NavigationStack {
                ProjectsView(orgID: orgID, role: role)
                    .navigationTitle("Projects")
            }
            .tabItem { Label("Projects", systemImage: "folder.fill") }
            .tag(OrgTab.projects)

            NavigationStack {
                WikiListView(orgID: orgID, role: role)
                    .navigationTitle("Wiki")
            }
            .tabItem { Label("Wiki", systemImage: "doc.text.fill") }
            .tag(OrgTab.wiki)

            NavigationStack {
                MembersView(orgID: orgID, role: role)
                    .navigationTitle("Members")
            }
            .tabItem { Label("Members", systemImage: "person.3.fill") }
            .tag(OrgTab.members)

            NavigationStack {
                OrgSettingsView(orgID: orgID, orgName: orgName, role: role, onSwitchOrg: onSwitchOrg, onSignOut: onSignOut)
                    .navigationTitle("Settings")
            }
            .tabItem { Label("Settings", systemImage: "gearshape.fill") }
            .tag(OrgTab.settings)
        }
    }
}
