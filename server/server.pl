#!/usr/bin/perl

use strict;
use warnings;

use utf8;
use DBI;
use SQL::Maker;
use SQL::QueryMaker qw(sql_raw);

use Mojolicious::Lite;
use JSON qw(decode_json encode_json);

use EV;
use AnyEvent;
use Digest::SHA qw(sha256_hex);

use Data::Dumper;

my $salt = "YOUR_SERVER_SALT";

app->config(hypnotoad => {listen => ['http://*:8080']});

my $database = 'temp.db';
my $data_source = "dbi:SQLite:dbname=$database";
my $dbh = DBI->connect($data_source, undef, undef, {RaiseError => 1}) || die;

my $builder = SQL::Maker->new('driver' => 'SQLite');

sub init_tables{
    $dbh->do(
<<END_SQL
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            created_at TEXT NOT NULL,
            remote_ip TEXT NOT NULL,
            session_key TEXT NOT NULL,
            pass TEXT
        );
END_SQL
    );

    $dbh->do(
<<END_SQL
        CREATE TABLE IF NOT EXISTS user_game_views (
            id INTEGER PRIMARY KEY,
            created_at TEXT NOT NULL,
            user_id INTEGER,
            game_id INTEGER
        );
END_SQL
    );

    $dbh->do(
<<END_SQL
        CREATE TABLE IF NOT EXISTS games (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            created_at TEXT NOT NULL,
            created_by INTEGER NOT NULL,
            player1_id INTEGER,
            player2_id INTEGER,
            pass TEXT NOT NULL
        );
END_SQL
    );

    $dbh->do(
<<END_SQL
        CREATE TABLE IF NOT EXISTS moves (
            id INTEGER PRIMARY KEY,
            game_id INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            player_side INTEGER NOT NULL,
            x INTEGER NOT NULL,
            y INTEGER NOT NULL
        );
END_SQL
    );

}
&init_tables();

sub insert_new_user{
    my ($name, $remote_ip, $key) = @_;
    my ($sql, @binds) = $builder->insert('users', {
        'name' => $name,
        'created_at' => \"datetime(CURRENT_TIMESTAMP)",
        'remote_ip' => $remote_ip,
        'session_key' => $key
    });
    $dbh->do($sql, {}, @binds);
    my $id = $dbh->last_insert_id($database, $database, 'users', 'id');
    ($sql, @binds) = $builder->select('users', ['name', 'id', 'session_key'], {'id' => $id});
    return $dbh->selectrow_hashref($sql, {}, @binds);
}

sub select_user_by_session_key{
    my $key = shift;
    my ($sql, @binds) = $builder->select('users', ['name', 'id'], {'session_key' => $key});
    return $dbh->selectrow_hashref($sql, {}, @binds);
}

sub select_user_by_id{
    my $id = shift;
    my ($sql, @binds) = $builder->select('users', ['name', 'id'], {'id' => $id});
    return $dbh->selectrow_hashref($sql, {}, @binds);
}

sub select_user_by_mojolite_instance{
    my $self = shift;
    my $key = $self->param("session_key");
    return select_user_by_session_key($key);
}

sub insert_new_user_game_view{
    my ($user_id, $game_id) = @_;
    my ($sql, @binds) = $builder->insert('user_game_views', {
        'created_at' => \"datetime(CURRENT_TIMESTAMP)",
        'user_id' => $user_id,
        'game_id' => $game_id
    });
    $dbh->do($sql, {}, @binds);
    my $id = $dbh->last_insert_id($database, $database, 'user_game_views', 'id');
    ($sql, @binds) = $builder->select('user_game_views', ['id', 'user_id', 'game_id', 'created_at'], {'id' => $id});
    return $dbh->selectrow_hashref($sql, {}, @binds);
}

sub select_user_game_view{
    my ($user_id, $game_id) = @_;
    my ($sql, @binds) = $builder->select('user_game_views', ['id', 'user_id', 'game_id', 'created_at'], {'user_id' => $user_id, 'game_id' => $game_id});
    return $dbh->selectrow_hashref($sql, {}, @binds);
}

sub insert_new_game{
    my ($name, $pass, $created_by) = @_;
    my ($sql, @binds) = $builder->insert('games', {
        'created_at' => \"datetime(CURRENT_TIMESTAMP)",
        'pass' => $pass,
        'name' => $name,
        'created_by' => $created_by
    });
    $dbh->do($sql, {}, @binds);
    my $id = $dbh->last_insert_id($database, $database, 'games', 'id');
    ($sql, @binds) = $builder->select('games', ['id', 'name', 'created_at'], {'id' => $id});
    return $dbh->selectrow_hashref($sql, {}, @binds);
}

sub select_game_by_id{
    my ($id) = @_;
    my ($sql, @binds) = $builder->select('games', ['id', 'name', 'created_at', 'player1_id', 'player2_id'], {'id' => $id});
    return $dbh->selectrow_hashref($sql, {}, @binds);
}

sub select_game_by_id_and_pass{
    my ($id, $pass) = @_;
    my ($sql, @binds) = $builder->select('games', ['id', 'name', 'created_at', 'player1_id', 'player2_id'], {'id' => $id, 'pass' => $pass});
    return $dbh->selectrow_hashref($sql, {}, @binds);
}

sub select_game_by_mojolite_instance_and_user{
    my $self = shift;
    my $user = shift;
    my $game_id = $self->param("game_id");
    my $pass = $self->param("game_pass");
    if (defined $pass) {
        my $result = select_game_by_id_and_pass($game_id, $pass);
        if (defined $result) {
            insert_new_user_game_view($user->{'id'}, $game_id);
        }
        return $result;
    }
    my $view = select_user_game_view($user->{'id'}, $game_id);
    if (defined $view) {
        return select_game_by_id($game_id);
    } else {
        return undef;
    }
}

sub update_game_set_players{
    my ($id, $player1_id, $player2_id) = @_;
    my ($sql, @binds) = $builder->update('games', {
        'player1_id' => $player1_id,
        'player2_id' => $player2_id
    }, {
        'id' => $id
    });
    $dbh->do($sql, {}, @binds);
}

sub insert_new_move{
    my ($game_id, $player_side, $x, $y) = @_;
    my ($sql, @binds) = $builder->insert('moves', {
        'created_at' => \"datetime(CURRENT_TIMESTAMP)",
        'player_side' => $player_side,
        'x' => $x,
        'y' => $y,
        'game_id' => $game_id
    });
    $dbh->do($sql, {}, @binds);
    my $id = $dbh->last_insert_id($database, $database, 'games', 'id');
    ($sql, @binds) = $builder->select('moves', ['created_at', 'player_side', 'x', 'y'], {'id' => $id});
    return $dbh->selectrow_hashref($sql, {}, @binds);
}

sub select_move_by_game_id_and_x_and_y{
    my ($game_id, $x, $y) = @_;
    my ($sql, @binds) = $builder->select('moves', ['id'], {'game_id' => $game_id, 'x' => $x, 'y' => $y});
    return $dbh->selectrow_hashref($sql, {}, @binds);
}

sub select_move_last_inserted{
    my ($game_id, $x, $y) = @_;
    my ($sql, @binds) = $builder->select('moves', ['created_at', 'player_side', 'x', 'y'], {'game_id' => $game_id}, {'order_by' => 'created_at desc', 'limit' => 1});
    return $dbh->selectrow_hashref($sql, {}, @binds);
}

sub select_moves_by_game_id{
    my ($game_id, $created_after) = @_;
    my $condition = $builder->new_condition();
    $condition->add('game_id' => $game_id)->add('created_at' => {
        '>' => $created_after || "2016-04-01 00:00:00"
    });
    my ($sql, @binds) = $builder->select('moves', ['created_at', 'player_side', 'x', 'y'], $condition, {'order_by' => 'datetime(created_at)'});
    return $dbh->selectall_arrayref($sql, {}, @binds);
}

#Serviceのような

sub check_and_update_game_players{
    my ($user, $game, $my_side) = @_;
    my $moves = select_moves_by_game_id($game->{'id'});
    #passを知っていればあとから新ユーザで再開できるようにするため、ここのチェックを無効化
    die "error" if (scalar(@$moves) > 0);
    if (!$game->{'player1_id'} && $my_side == 1){
        update_game_set_players($game->{'id'}, $user->{'id'}, $game->{'player2_id'} == $user->{'id'} ? undef : $game->{'player2_id'});
    } elsif (!$game->{'player2_id'} && $my_side == 2){
        update_game_set_players($game->{'id'}, $game->{'player1_id'} == $user->{'id'} ? undef : $game->{'player1_id'}, $user->{'id'});
    } else {
        die "error";
    }
    return select_game_by_id($game->{'id'});
}

sub check_and_select_moves{
    my ($user, $game, $created_after) = @_;
    my $player_side = undef;
    if (defined $game->{"player1_id"} && $game->{"player1_id"} == $user->{'id'}) {
        $player_side = 1;
    } elsif (defined $game->{"player2_id"} && $game->{"player2_id"} == $user->{'id'}) {
        $player_side = 2;
    }
    die "error" unless (defined $player_side);
    return select_moves_by_game_id($game->{'id'}, $created_after);
}

sub check_and_insert_new_move{
    my ($user, $game, $x, $y) = @_;
    unless (1 <= $x && $x <= 8 && 1 <= $y && $y <= 8) {
        die "error";
    }
    my $player_side = undef;
    if (defined $game->{"player1_id"} && $game->{"player1_id"} == $user->{'id'}) {
        $player_side = 1;
    } elsif (defined $game->{"player2_id"} && $game->{"player2_id"} == $user->{'id'}) {
        $player_side = 2;
    }
    unless (defined $player_side && $game->{"player1_id"} && $game->{"player2_id"}) {
        die "error";
    }
    #postしたユーザがプレイヤーに含まれている、かつプレイヤー二人が確定しているときのみ
    my $xy_move = select_move_by_game_id_and_x_and_y($game->{'id'}, $x, $y);
    if (defined $xy_move) {
        die "error";
    }
    my $last_inserted = select_move_last_inserted($game->{'id'});
    if (int($last_inserted->{'player_side'}) == $player_side) {
        die "error";
    }
    return insert_new_move($game->{'id'}, $player_side, $x, $y);
}


#以下Controller
#値チェックは省略、DBで怒られたらアウト

post '/users' => sub {
    my $self = shift;
    my $user_name = $self->param("user_name");
    my $user = insert_new_user($user_name, $self->tx->remote_address, Digest::SHA->sha256_hex(int(rand(10000)) . $salt. int(rand(10000))));
    $self->render(json => {'user' => $user});
};

get '/users/me' => sub {
    my $self = shift;
    my $user = select_user_by_mojolite_instance($self);
    return $self->reply->not_found unless defined $user;
    $self->render(json => {'user' => $user});
};

post '/games' => sub {
    my $self = shift;
    my $user = select_user_by_mojolite_instance($self);
    return $self->reply->not_found unless defined $user;
    my $game_name = $self->param("game_name") || "New Game";
    my $game_pass = $self->param("game_pass") || "00000";
    my $game = insert_new_game($game_name, $game_pass, $user->{'id'});
    insert_new_user_game_view($user->{'id'}, $game->{'id'});
    $self->render(json => {'game' => $game});
};

get '/games/:game_id' => sub {
    my $self = shift;
    my $user = select_user_by_mojolite_instance($self);
    return $self->reply->not_found unless defined $user;
    my $game = select_game_by_mojolite_instance_and_user($self, $user);
    return $self->reply->not_found unless defined $game;
    $self->render(json => {'game' => $game});
};

put '/games/:game_id' => sub {
    my $self = shift;
    my $user = select_user_by_mojolite_instance($self);
    return $self->reply->not_found unless defined $user;
    my $game = select_game_by_mojolite_instance_and_user($self, $user);
    return $self->reply->not_found unless defined $game;
    my $my_side = int($self->param('my_side'));
    $game = check_and_update_game_players($user, $game, $my_side);
    $self->render(json => {'game' => $game});
};

post '/games/:game_id/moves' => sub {
    my $self = shift;
    my $user = select_user_by_mojolite_instance($self);
    return $self->reply->not_found unless defined $user;
    my $game = select_game_by_mojolite_instance_and_user($self, $user);
    return $self->reply->not_found unless defined $game;
    my $x = int($self->param("x"));
    my $y = int($self->param("y"));
    my $move = check_and_insert_new_move($user, $game, $x, $y);
    $self->render(json => {'game' => $game, 'move' => $move});
};

get '/games/:game_id/moves' => sub {
    my $self = shift;
    my $user = select_user_by_mojolite_instance($self);
    return $self->reply->not_found unless defined $user;
    my $game = select_game_by_mojolite_instance_and_user($self, $user);
    return $self->reply->not_found unless defined $game;
    my $created_after = $self->param("created_after");
    my $moves = check_and_select_moves($user, $game, $created_after);
    $self->render(json => {'game' => $game, 'moves' => $moves, 'user' => $user});
};

options '/*any' => sub {
    my $self = shift;
    #DO NOTHING
    $self->render(json=> {});
};

my $STATE_CONNECTED = 0;
my $STATE_AUTHORIZED = 2;
my $STATE_CHECKING_STATE = 3;

my $ws_map_con_id_to_auth_state = {};
my $ws_map_game_id_to_con_ids = {};
my $ws_map_con_id_to_socket_instance = {};
my $ws_map_con_id_to_user_id = {};

sub get_connection_id{
	my $self = shift;
	return sprintf ("%s", $self->tx);
}

sub register_connection{
    my $self = shift;
    my $con_id = get_connection_id($self);
    &update_auth_state($con_id, $STATE_CONNECTED);
    $ws_map_con_id_to_socket_instance->{$con_id} = $self;
}

sub delete_connection{
    my $self = shift;
    my $con_id_to_delete = get_connection_id($self);
    delete($ws_map_con_id_to_auth_state->{$con_id_to_delete});
    delete($ws_map_con_id_to_socket_instance->{$con_id_to_delete});
    delete($ws_map_con_id_to_user_id->{$con_id_to_delete});
    my $found = 0;
    foreach my $game_id (keys $ws_map_game_id_to_con_ids) {
        my $con_ids = $ws_map_game_id_to_con_ids->{$game_id};
        my $i = 0;
        foreach my $con_id(@$con_ids) {
            if ($con_id eq $con_id_to_delete) {
                splice($con_ids, $i, 1);
                $found = 1;
                send_other_clients_info($game_id);
                app->log->debug("delete ok");
                last;
            }
            $i++;
        }
        last if ($found);
    }
}

sub update_auth_state{
    my $con_id = shift;
    my $state = shift;
    $ws_map_con_id_to_auth_state->{$con_id} = $state;
}

sub set_user_id_to_con_id{
    my $con_id = shift;
    my $user_id = shift;
    $ws_map_con_id_to_user_id->{$con_id} = $user_id;
}

sub get_user_id_by_con_id{
    my $con_id = shift;
    return $ws_map_con_id_to_user_id->{$con_id};
}

sub get_auth_state{
    my $con_id = shift;
    return $ws_map_con_id_to_auth_state->{$con_id};
}

sub get_socket_instance{
    my $con_id = shift;
    return $ws_map_con_id_to_socket_instance->{$con_id};
}

sub add_con_id_to_game_id{
    my $game_id = shift;
    my $con_id = shift;
    unless ($ws_map_game_id_to_con_ids->{$game_id}) {
        $ws_map_game_id_to_con_ids->{$game_id} = [];
    }
    push($ws_map_game_id_to_con_ids->{$game_id}, $con_id);
}

sub get_con_ids_by_game_id{
    my $game_id = shift;
    return $ws_map_game_id_to_con_ids->{$game_id} || [];
}

sub get_socket_instances_by_game_id{
    my $game_id = shift;
    my $con_ids = get_con_ids_by_game_id($game_id);
    my $instances = [];
    foreach my $con_id (@$con_ids){
        push($instances, get_socket_instance($con_id));
    }
    return $instances;
}

my $PATH_TO_AUTH = "/games/:game_id";
my $PATH_TO_MOVES = "/games/:game_id/moves";

sub send_response_success{
    my $self = shift;
    my $request_id = shift;
    my $body_json = shift;
    eval{
        $self->send(encode_json({'MESSAGE_TYPE' => 'RESPONSE', 'RESPONSE' => $body_json, 'REQUEST_ID' => $request_id}));
    };
    if ($@) {
        #切断対象
    }
}

sub send_check_connection_state{
    my $self = shift;
    eval{
        $self->send(encode_json({'MESSAGE_TYPE' => 'CHECK_CONNECTION_STATE'}));
    };
    if ($@) {
        #切断対象
    }
}

sub send_other_clients_info{
    my $game_id = shift;
    my $con_ids = get_con_ids_by_game_id($game_id);
    my $users = [];
    foreach my $con_id (@$con_ids){
        push($users, select_user_by_id(get_user_id_by_con_id($con_id)));
    }
    foreach my $con_id (@$con_ids){
        my $instance = get_socket_instance($con_id);
        eval{
            $instance->send(encode_json({'MESSAGE_TYPE' => 'CLIENTS_INFO', 'RESPONSE' => {'users' => $users, 'game' => select_game_by_id($game_id)}, 'REQUEST_ID' => "-1"}));
        };
        if ($@) {
            #切断対象
        }
    }
}

sub proc_game_request{
    my ($self, $request, $request_id, $method, $path, $queries) = @_;
    my $con_id = get_connection_id($self);
    my $auth_state = get_auth_state($con_id);
    my $session_key = $queries->{"session_key"};
    my $game_id = $queries->{"game_id"};
    return if ($path !~ /$PATH_TO_AUTH/ && $auth_state == $STATE_CONNECTED);
    return unless (defined $session_key && defined $game_id);
    my $user = select_user_by_session_key($session_key);
    my $game = select_game_by_id($game_id);
    return unless (defined $user && $game);
    app->log->debug("START PARSE PATH");
    if ($path eq $PATH_TO_AUTH) {
        #認証用パス
        #何もせず結果送信
        app->log->debug("AUTH OK");
        add_con_id_to_game_id($game->{'id'}, $con_id);
        set_user_id_to_con_id($con_id, $user->{'id'});
        send_other_clients_info($game->{'id'});
        send_response_success($self, $request_id, {'game' => $game});
        return 1;
    } elsif ($path eq $PATH_TO_MOVES) {
        #post、または一覧
        if ($method eq "POST") {
            my $x = int($queries->{"x"});
            my $y = int($queries->{"y"});
            my $move = check_and_insert_new_move($user, $game, $x, $y);
            send_response_success($self, $request_id, {'game' => $game, 'move' => $move});
            #broadcastする
            my $instances = get_socket_instances_by_game_id($game->{'id'});
            foreach my $instance (@$instances) {
                if (get_connection_id($instance) ne get_connection_id($self)) {
                    send_response_success($instance, $request_id, {'game' => $game, 'move' => $move, 'other_players_move' => 1});
                }
            }
        } elsif ($method eq "GET") {
            my $created_after = $queries->{"created_after"};
            my $moves = check_and_select_moves($user, $game, $created_after);
            return send_response_success($self, $request_id, {'game' => $game, 'moves' => $moves});
        }
    }
}

sub proc_request{
    my $self = shift;
    my $request = shift;
    my $request_id = shift;
    my $method = $request->{"METHOD"};
    my $path = $request->{"PATH"};
    my $queries = $request->{"QUERIES"};
    return unless (defined $queries && defined $method && defined $path);
    app->log->debug("PROC_REQUEST_MODE");
    proc_game_request($self, $request, $request_id, $method, $path, $queries);
}

sub proc_tell_state_ok{
    my $self = shift;
    my $request_id = shift;
    my $con_id = get_connection_id($self);
    my $auth_state = get_auth_state($con_id);
    app->log->debug("PROC_TELL_STATE_OK_MODE");
    update_auth_state($con_id, $STATE_AUTHORIZED) if ($auth_state == $STATE_CHECKING_STATE);
    app->log->debug("$con_id OKAY");
}

my $inner_timer;
my $w = AnyEvent->timer(after => 20, interval => 20, cb => sub{
	foreach my $con_id (keys $ws_map_con_id_to_socket_instance){
        my $instance = get_socket_instance($con_id);
        my $auth_state = get_auth_state($con_id);
        update_auth_state($con_id, $STATE_CHECKING_STATE);
        send_check_connection_state($instance);
	}

	$inner_timer = AnyEvent->timer(
	    after => 10,
	    cb => sub {
            app->log->debug("check instances to delete");
            foreach my $con_id (keys $ws_map_con_id_to_socket_instance){
                my $state = get_auth_state($con_id);
                if ($state == $STATE_CHECKING_STATE) {
                    #削除対象
                    app->log->debug("$con_id is to delete");
                    my $instance = get_socket_instance($con_id);
                    eval {
                        $instance->finish;
                    };
                    delete_connection($instance);
                }
            }
			undef $inner_timer;
	    }
	);
});

websocket '/ws' => sub {
    my $self = shift;
	Mojo::IOLoop->stream($self->tx->connection)->timeout(600);

    #接続確立時
    register_connection($self);

    #メッセージ受信時
    $self->on(json => sub {
        my ($self, $json) = @_;

        eval{
            app->log->debug("JSON OK");

            my $message_type = $json->{'MESSAGE_TYPE'};
            my $request_id = $json->{'REQUEST_ID'};

            return unless (defined $message_type);

            if ($message_type eq "REQUEST") {
                my $request = $json->{'REQUEST'};
                return unless (defined $request);
                proc_request($self, $request, $request_id);
            } elsif ($message_type eq "TELL_STATE_OK") {
                proc_tell_state_ok($self, $request_id);
            }
        };

        if ($@) {
            #error
        }
    });

    #切断時
    $self->on(finish => sub {
        my $self = shift;
        #ToDo: 完全に削除する前に、他のユーザに切断を通知する必要
        delete_connection($self);
    });
};

hook before_render => sub {
    my ($self, $args) = @_;

    $self->res->headers->header('Access-Control-Allow-Origin' => '*');
    $self->res->headers->header('Access-Control-Allow-Headers' => 'Authorization,Content-Type,if-modified-since');
    $self->res->headers->header('Access-Control-Allow-Methods' => 'GET,POST,PUT,DELETE,OPTIONS');
    $self->res->headers->header('Access-Control-Max-Age' => '1728000');

    return unless my $template = $args->{template};
    return unless $template eq 'exception';
    $args->{json} = {exception => $self->stash('exception')};

};

app->start;
