import { Broadcast } from '../../../models/src'
import { notify } from '../socket'

class BroadcastService {
    async broadcastMessage(broadcast: Broadcast): Promise<void> {
        notify.broadcast(broadcast)
    }
}

export default new BroadcastService()
