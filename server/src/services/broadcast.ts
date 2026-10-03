import { Broadcast } from '../../../models/src'
import { notify } from '../socket'
import { VenueContext } from '../venue/context'

class BroadcastService {
    async broadcastMessage(_ctx: VenueContext, broadcast: Broadcast): Promise<void> {
        notify.broadcast(broadcast)
    }
}

export default new BroadcastService()
