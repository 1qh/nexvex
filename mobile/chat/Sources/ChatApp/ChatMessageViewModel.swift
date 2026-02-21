import ConvexShared
import Foundation
import Observation

@MainActor
@Observable
internal final class ChatMessageViewModel {
    var messages = [Message]()

    var isLoading = true

    var isAiLoading = false

    var messageText = ""

    var errorMessage: String?

    private var subscriptionID: String?

    func startSubscription(chatID: String) {
        stopSubscription()
        isLoading = true
        errorMessage = nil

        #if !SKIP
        subscriptionID = ConvexService.shared.subscribe(
            to: "message:list",
            args: ["chatId": chatID],
            type: [Message].self,
            onUpdate: { [weak self] (result: [Message]) in
                self?.messages = result
                self?.isLoading = false
            },
            onError: { [weak self] error in
                self?.errorMessage = error.localizedDescription
                self?.isLoading = false
            }
        )
        #else
        subscriptionID = ConvexService.shared.subscribeMessages(
            to: "message:list",
            args: ["chatId": chatID],
            onUpdate: { result in
                self.messages = Array(result)
                self.isLoading = false
            },
            onError: { error in
                self.errorMessage = error.localizedDescription
                self.isLoading = false
            }
        )
        #endif
    }

    func stopSubscription() {
        cancelSubscription(&subscriptionID)
    }

    func sendMessage(chatID: String) {
        let text = messageText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else {
            return
        }

        messageText = ""

        Task {
            do {
                let parts: [[String: Any]] = [["type": "text", "text": text]]
                try await ConvexService.shared.mutate("message:create", args: [
                    "chatId": chatID,
                    "parts": parts,
                    "role": "user",
                ])

                isAiLoading = true
                #if !SKIP
                let _: [String: String] = try await ConvexService.shared.action(
                    "mobile-ai:chat",
                    args: ["chatId": chatID],
                    returning: [String: String].self
                )
                #else
                try await ConvexService.shared.action(
                    name: "mobile-ai:chat",
                    args: ["chatId": chatID]
                )
                #endif
                isAiLoading = false
            } catch {
                errorMessage = error.localizedDescription
                isAiLoading = false
            }
        }
    }
}
