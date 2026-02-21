import ConvexShared
import SwiftUI

internal struct PriorityBadge: View {
    let priority: String

    private var priorityColor: Color {
        switch priority {
        case "high":
            .red

        case "medium":
            .orange

        default:
            .blue
        }
    }

    var body: some View {
        Text(priority.capitalized)
            .font(.caption2)
            .padding(.horizontal, 6)
            .padding(.vertical, 1)
            .background(priorityColor.opacity(0.15))
            .foregroundStyle(priorityColor)
            .clipShape(Capsule())
    }
}

internal struct TasksView: View {
    let orgID: String
    let projectID: String
    let role: String

    @State private var viewModel = TasksViewModel()
    @State private var newTaskTitle = ""

    var body: some View {
        VStack(spacing: 0) {
            if viewModel.isLoading, viewModel.tasks.isEmpty {
                Spacer()
                ProgressView()
                Spacer()
            } else {
                List(viewModel.tasks) { task in
                    HStack {
                        Button(action: {
                            viewModel.toggleTask(orgID: orgID, taskID: task._id)
                        }) {
                            Image(systemName: task.completed == true ? "checkmark.circle.fill" : "circle")
                                .foregroundStyle(task.completed == true ? .green : .secondary)
                                .accessibilityHidden(true)
                        }
                        .accessibilityIdentifier("toggleTask")
                        .buttonStyle(.plain)

                        VStack(alignment: .leading, spacing: 2) {
                            Text(task.title)
                                .strikethrough(task.completed == true)
                                .foregroundStyle(task.completed == true ? .secondary : .primary)
                            if let priority = task.priority {
                                PriorityBadge(priority: priority)
                            }
                        }
                        Spacer()
                    }
                    .padding(.vertical, 2)
                }
                .listStyle(.plain)
            }

            HStack(spacing: 8) {
                TextField("New task...", text: $newTaskTitle)
                #if !SKIP
                    .textFieldStyle(.roundedBorder)
                #endif
                    .onSubmit { addTask() }
                Button(action: addTask) {
                    Image(systemName: "plus.circle.fill")
                        .font(.title2)
                        .accessibilityHidden(true)
                }
                .accessibilityIdentifier("addTaskButton")
                .disabled(newTaskTitle.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
            .padding()
        }
        .navigationTitle("Tasks")
        .task {
            viewModel.startSubscription(orgID: orgID, projectID: projectID)
        }
        .onDisappear {
            viewModel.stopSubscription()
        }
    }

    private func addTask() {
        let title = newTaskTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty else {
            return
        }

        viewModel.createTask(orgID: orgID, projectID: projectID, title: title)
        newTaskTitle = ""
    }
}
