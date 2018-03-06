
import { Repository, Connection } from 'typeorm';
import { TestUser } from '../entities/examples/User';


export class MockData {

    repo() {
        return {
            users: this.connection.getRepository(TestUser)
        }
    }

    constructor(private connection: Connection) {
        this.createUser();
        return this;
    }

    async createUser() {
        const user = new TestUser();
        user.name = 'Dariusz';
        user.username = 'darekf77';
        await this.repo().users.save(user);
    }

}