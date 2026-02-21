import ConvexShared
import SkipKit
import SwiftUI

internal struct ProfileView: View {
    @State private var viewModel = ProfileViewModel()

    @State private var showAvatarPicker = false

    var body: some View {
        Group {
            if viewModel.isLoading {
                ProgressView()
            } else {
                Form {
                    Section("Avatar") {
                        if viewModel.isUploadingAvatar {
                            ProgressView("Uploading...")
                        } else if viewModel.avatarID != nil {
                            HStack {
                                Image(systemName: "person.crop.circle.fill")
                                    .foregroundStyle(.green)
                                    .accessibilityHidden(true)
                                Text("Avatar set")
                                Spacer()
                                Button("Remove") { viewModel.removeAvatar() }
                                    .foregroundStyle(.red)
                            }
                        }
                        Button(viewModel.avatarID != nil ? "Change Avatar" : "Select Avatar") {
                            showAvatarPicker = true
                        }
                        .withMediaPicker(type: .library, isPresented: $showAvatarPicker, selectedImageURL: $viewModel.selectedAvatarURL)
                        .onChange(of: viewModel.selectedAvatarURL) { _, _ in viewModel.uploadAvatar() }
                    }

                    Section("Display Name") {
                        TextField("Your name", text: $viewModel.displayName)
                    }

                    Section("Bio") {
                        TextEditor(text: $viewModel.bio)
                            .frame(minHeight: 80)
                    }

                    Section("Theme") {
                        Picker("Theme", selection: $viewModel.theme) {
                            ForEach(viewModel.themes, id: \.self) { t in
                                Text(t.capitalized).tag(t)
                            }
                        }
                        .pickerStyle(.segmented)
                    }

                    Section {
                        Toggle("Notifications", isOn: $viewModel.notifications)
                    }

                    if viewModel.errorMessage != nil {
                        Section {
                            ErrorBanner(message: viewModel.errorMessage)
                        }
                    }

                    Section {
                        Button(action: { viewModel.save() }) {
                            if viewModel.isSaving {
                                ProgressView()
                                    .frame(maxWidth: .infinity)
                            } else {
                                Text("Save")
                                    .frame(maxWidth: .infinity)
                            }
                        }
                        .disabled(viewModel.isSaving || viewModel.isUploadingAvatar || viewModel.displayName
                            .trimmingCharacters(in: .whitespacesAndNewlines)
                            .isEmpty)
                    }
                }
            }
        }
        .navigationTitle(viewModel.profile != nil ? "Edit Profile" : "Set Up Profile")
        .task {
            viewModel.startSubscription()
        }
        .onDisappear {
            viewModel.stopSubscription()
        }
    }
}
