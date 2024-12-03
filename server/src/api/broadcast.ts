import db from "../db"
import { Broadcast } from "../../../models/src"
import { SocketIOService } from "../socket"
import { getCurrentDateTimeInItaly } from "../utils/helper"

class BroadcastApi {
    constructor() {
    }

    async broadcastMessage(broadcast: Broadcast): Promise<void> {
        SocketIOService.instance().sendMessage({
            room: "main",
            event: "broadcast",
            body: broadcast
        })
    }
}

const broadcastApi = new BroadcastApi()
export default broadcastApi